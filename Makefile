SHELL := /bin/bash
.DEFAULT_GOAL := help

# Configurable inputs
ENV_FILE ?= .env
STATE_DIR ?= .cutover_state
JOBS ?= 4
RCLONE_REMOTE ?= gdrive:chitty-backups/neon
BACKUP_NAME ?= neon-prod-$(shell date +%F-%H%M)

REQUIRED_TOOLS := psql pg_dump pg_restore curl jq rclone
OPTIONAL_TOOLS := wrangler
SKIP_CONN_CHECKS ?= 0

# Internal helpers
define _load_env
  set -euo pipefail
  if [ -f "$(ENV_FILE)" ]; then
    source "$(ENV_FILE)"
  fi
endef

define _require_vars
  missing=0; \
  for v in $(1); do \
    if [ -z "$$\{$$v:-\}" ]; then echo "Missing $$v"; missing=1; fi; \
  done; \
  if [ $$missing -ne 0 ]; then echo "Set missing vars in $(ENV_FILE)"; exit 1; fi
endef

.PHONY: help check-tools check-env preflight print-env login \
        snapshot freeze-confirm dump backup restore migrate-schema validate \
        flip-secrets post-cutover delete-snapshot cutover

help: ## Show targets and usage
	@awk 'BEGIN {FS":.*?## "}; /^[a-zA-Z0-9_%\-\/]+:.*?## / {printf "%-24s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

print-env: ## Show resolved environment (from .env) with secrets redacted
	@bash -lc '\
  $(call _load_env); \
  env | sort | egrep "^(NEON_|CF_|RCLONE_REMOTE|BACKUP_NAME|APP_SECRET_PATH|ENV_FILE|STATE_DIR)=" | \
  awk -F= '\''{ key=$$1; val=$$2; if (key ~ /(API_KEY|TOKEN|PASSWORD|PASS|SECRET|_DB_URL|DATABASE_URL)$/) {val="***"}; print key"="val }'\'' || true; \
'

login: ## Convenience: Cloudflare wrangler login and rclone hints
	@bash -lc '\
  if command -v wrangler >/dev/null 2>&1; then \
    echo "Opening Cloudflare login..."; wrangler login || true; \
  else \
    echo "wrangler not found; skipping Cloudflare login"; \
  fi; \
  echo; \
  echo "rclone (Drive) quickstart:"; \
  echo "  rclone config create gdrive drive scope=drive.file service_account_file=/path/sa.json"; \
  echo "Then set RCLONE_REMOTE=gdrive:chitty-backups/neon in $(ENV_FILE)"; \
'

check-tools: ## Check required CLIs are installed
	@bash -lc '\
  $(call _load_env); \
  ok=1; \
  for t in $(REQUIRED_TOOLS); do \
    if ! command -v $$t >/dev/null 2>&1; then echo "Missing $$t"; ok=0; fi; \
  done; \
  if ! command -v wrangler >/dev/null 2>&1; then echo "Note: wrangler not found (flip via API or install wrangler)"; fi; \
  if [ $$ok -ne 1 ]; then exit 1; fi; \
  echo "All required tools present."; \
'

check-env: ## Validate required env vars
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_API_KEY NEON_PROJECT_ID NEON_SOURCE_DB_URL NEON_TARGET_DB_URL); \
  mkdir -p "$(STATE_DIR)"; \
  echo "Environment looks good."; \
'

preflight: check-tools check-env ## Deeper checks: Cloudflare/rclone and optional DB connectivity
	@bash -lc '\
  $(call _load_env); \
  echo "== Cloudflare path =="; \
  if [ -n "$$\{CF_API_TOKEN:-\}" ] && [ -n "$$\{CF_ACCOUNT_ID:-\}" ] && [ -n "$$\{CF_WORKER_NAME:-\}" ] && [ -n "$$\{CF_SECRET_NAME:-\}" ]; then \
    echo "Cloudflare API configured for $$CF_WORKER_NAME (secret $$CF_SECRET_NAME)"; \
  elif command -v wrangler >/dev/null 2>&1 && [ -n "$$\{CF_SECRET_NAME:-\}" ]; then \
    echo "Will use wrangler secret put $$CF_SECRET_NAME (set CF_WORKER_NAME if needed)"; \
  else \
    echo "Cloudflare not fully configured; flip-secrets will be skipped unless configured."; \
  fi; \
  echo; \
  echo "== Rclone remote =="; \
  if command -v rclone >/dev/null 2>&1; then \
    if rclone lsjson "$$\{RCLONE_REMOTE:-$(RCLONE_REMOTE)\}" --max-depth 0 >/dev/null 2>&1; then \
      echo "Rclone remote reachable: $$\{RCLONE_REMOTE:-$(RCLONE_REMOTE)\}"; \
    else \
      echo "Warning: cannot access $$\{RCLONE_REMOTE:-$(RCLONE_REMOTE)\}. Ensure remote exists and credentials are valid."; \
    fi; \
  fi; \
  echo; \
  echo "== DB connectivity =="; \
  if [ "$(SKIP_CONN_CHECKS)" = "1" ]; then \
    echo "Skipping connection checks (SKIP_CONN_CHECKS=1)"; \
  else \
    if psql "$$NEON_SOURCE_DB_URL" -Atqc "select 1" >/dev/null 2>&1; then echo "Source DB OK"; else echo "Warning: cannot connect to source DB"; fi; \
    if psql "$$NEON_TARGET_DB_URL" -Atqc "select 1" >/dev/null 2>&1; then echo "Target DB OK"; else echo "Warning: cannot connect to target DB"; fi; \
  fi; \
'

snapshot: check-tools check-env ## Create Neon snapshot branch and save branch_id
	@bash -lc '\
  $(call _load_env); \
  mkdir -p "$(STATE_DIR)"; \
  auth="Authorization: Bearer $$NEON_API_KEY"; \
  base="https://console.neon.tech/api/v2/projects/$$NEON_PROJECT_ID"; \
  ts=$$(date +%F-%H%M); \
  echo "Creating snapshot branch at $$ts ..."; \
  resp=$$(curl -s -H "$$auth" -H "Content-Type: application/json" -d "{\"branch\":{\"name\":\"snapshot-$$ts\"}}" "$$base/branches"); \
  branch_id=$$(echo "$$resp" | jq -r ".branch.id"); \
  if [ "$$branch_id" = "null" ] || [ -z "$$branch_id" ]; then echo "Failed to create branch:"; echo "$$resp" | jq .; exit 1; fi; \
  echo "$$branch_id" | tee "$(STATE_DIR)/branch_id" >/dev/null; \
  echo "Snapshot branch: $$branch_id"; \
'

freeze-confirm: ## Confirm app layer is write-frozen
	@bash -lc '\
  read -p "Confirm app is in write-freeze (y/N): " ans; \
  case "$$ans" in y|Y|yes|YES) echo "Proceeding...";; *) echo "Abort. Freeze first."; exit 1;; esac; \
'

dump: check-tools ## Dump data and globals from source
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_SOURCE_DB_URL); \
  echo "Dumping to $(BACKUP_NAME).dump"; \
  pg_dump --no-owner --format=custom -j $(JOBS) -d "$$NEON_SOURCE_DB_URL" -f "$(BACKUP_NAME).dump"; \
  echo "Dumping globals to $(BACKUP_NAME).globals.sql"; \
  pg_dumpall --globals-only -d "$$NEON_SOURCE_DB_URL" > "$(BACKUP_NAME).globals.sql"; \
  ls -lh "$(BACKUP_NAME).dump" "$(BACKUP_NAME).globals.sql"; \
'

backup: ## Ship dump + globals to rclone remote
	@bash -lc '\
  $(call _load_env); \
  rclone copy "$(BACKUP_NAME).dump" "$$\{RCLONE_REMOTE:-$(RCLONE_REMOTE)\}/"; \
  rclone copy "$(BACKUP_NAME).globals.sql" "$$\{RCLONE_REMOTE:-$(RCLONE_REMOTE)\}/"; \
  echo "Shipped to $$RCLONE_REMOTE"; \
'

restore: check-tools ## Restore into target
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_TARGET_DB_URL); \
  echo "Restoring $(BACKUP_NAME).dump to $$NEON_TARGET_DB_URL"; \
  pg_restore -j $(JOBS) --no-owner --no-privileges -d "$$NEON_TARGET_DB_URL" "$(BACKUP_NAME).dump"; \
  echo "Applying globals (ignoring errors)"; \
  psql "$$NEON_TARGET_DB_URL" -f "$(BACKUP_NAME).globals.sql" || true; \
'

migrate-schema: ## Apply supplementary schema (conversations/entities/docs)
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_TARGET_DB_URL); \
  psql "$$NEON_TARGET_DB_URL" -v ON_ERROR_STOP=1 -f db/supplementary_schema.sql; \
'

validate: ## Quick table counts on target
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_TARGET_DB_URL); \
  for t in conversation message entity document; do \
    printf "%s: " $$t; psql "$$NEON_TARGET_DB_URL" -Atc "select count(*) from $$t" || echo "N/A"; \
  done; \
'

flip-secrets: ## Flip Cloudflare Worker secret to target DB URL
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_TARGET_DB_URL); \
  if [ -n "$$\{CF_API_TOKEN:-\}" ] && [ -n "$$\{CF_ACCOUNT_ID:-\}" ] && [ -n "$$\{CF_WORKER_NAME:-\}" ] && [ -n "$$\{CF_SECRET_NAME:-\}" ]; then \
    echo "Using Cloudflare API to update secret $$CF_SECRET_NAME on $$CF_WORKER_NAME"; \
    curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$$CF_ACCOUNT_ID/workers/scripts/$$CF_WORKER_NAME/secrets" \
      -H "Authorization: Bearer $$CF_API_TOKEN" -H "Content-Type: application/json" \
      -d "{\"name\":\"$$CF_SECRET_NAME\",\"text\":\"$$NEON_TARGET_DB_URL\",\"type\":\"secret_text\"}" | jq .; \
  elif command -v wrangler >/dev/null 2>&1 && [ -n "$$\{CF_SECRET_NAME:-\}" ]; then \
    echo "No CF API token provided. Falling back to interactive wrangler."; \
    echo "You will be prompted to paste the target DB URL."; \
    echo -n "$$NEON_TARGET_DB_URL" | wrangler secret put "$$CF_SECRET_NAME" --name "$$\{CF_WORKER_NAME:-\}"; \
  else \
    echo "Cloudflare env not configured and wrangler not available. Skipping."; exit 1; \
  fi; \
'

post-cutover: ## Optionally delete snapshot branch
	@bash -lc '\
  $(call _load_env); \
  branch_id=""; [ -f "$(STATE_DIR)/branch_id" ] && branch_id=$$(cat "$(STATE_DIR)/branch_id"); \
  if [ -z "$$branch_id" ]; then echo "No branch_id found in $(STATE_DIR)/branch_id"; exit 0; fi; \
  echo "Snapshot branch: $$branch_id"; \
  read -p "Delete snapshot branch now? (y/N): " ans; \
  case "$$ans" in \
    y|Y|yes|YES) \
      $(call _require_vars,NEON_API_KEY NEON_PROJECT_ID); \
      auth="Authorization: Bearer $$NEON_API_KEY"; \
      base="https://console.neon.tech/api/v2/projects/$$NEON_PROJECT_ID"; \
      curl -s -H "$$auth" -X DELETE "$$base/branches/$$branch_id" | jq .; \
      ;; \
    *) \
      echo "Keeping snapshot. You can delete later with: make delete-snapshot"; \
      ;; \
  esac; \
'

delete-snapshot: ## Delete snapshot branch saved in state
	@bash -lc '\
  $(call _load_env); \
  $(call _require_vars,NEON_API_KEY NEON_PROJECT_ID); \
  branch_id=$$(cat "$(STATE_DIR)/branch_id"); \
  auth="Authorization: Bearer $$NEON_API_KEY"; \
  base="https://console.neon.tech/api/v2/projects/$$NEON_PROJECT_ID"; \
  curl -s -H "$$auth" -X DELETE "$$base/branches/$$branch_id" | jq .; \
'

cutover: check-tools check-env ## Run snapshot→dump→backup→restore→schema→validate with prompts
	@bash -lc '$(call _load_env); echo "Starting cutover with BACKUP_NAME=$(BACKUP_NAME)"'
	$(MAKE) preflight
	$(MAKE) snapshot
	$(MAKE) freeze-confirm
	$(MAKE) dump
	$(MAKE) backup
	$(MAKE) restore
	$(MAKE) migrate-schema
	$(MAKE) validate
	@bash -lc '\
  read -p "Flip Cloudflare secrets now? (y/N): " ans; \
  case "$$ans" in y|Y|yes|YES) exit 0;; *) exit 99;; esac; \
'
	-$(MAKE) flip-secrets
	@echo "Cutover completed. Consider running: make post-cutover"
