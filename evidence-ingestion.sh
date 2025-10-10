#!/bin/bash

# ChittyOS Evidence Ingestion Script
# Selective ingestion from Arias V Bianchi case into ChittyOS platform

set -e

# Configuration
CHITTYOS_DATA="/Users/nb/Library/CloudStorage/GoogleDrive-nick@jeanarlene.com/Shared drives/ChittyOS-Data"
CASE_DATA="/Users/nb/Library/CloudStorage/GoogleDrive-nick@jeanarlene.com/Shared drives/Arias V Bianchi"
INTAKE_SCRIPT="$CHITTYOS_DATA/intake_with_chittyid.sh"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_title() { echo -e "${CYAN}[CHITTYOS]${NC} $1"; }

# Priority evidence patterns (most important legal documents)
PRIORITY_PATTERNS=(
    "ENTERED.*Order"
    "FILED.*Petition"
    "FILED.*Response"
    "Financial Affidavit"
    "ARIBIA.*Operating Agreement"
    "Lease Agreement"
    "Deed"
    "Mortgage"
    "Wire Receipt"
    "Tax Return"
    "Corporate Filing"
)

# Function to check if file matches priority patterns
is_priority_evidence() {
    local filename="$1"
    for pattern in "${PRIORITY_PATTERNS[@]}"; do
        if [[ "$filename" =~ $pattern ]]; then
            return 0
        fi
    done
    return 1
}

# Function to ingest a single file
ingest_file() {
    local file_path="$1"
    local filename="$(basename "$file_path")"

    log_info "Processing: $filename"

    if [ -x "$INTAKE_SCRIPT" ]; then
        if "$INTAKE_SCRIPT" "$file_path"; then
            log_info "✅ Successfully ingested: $filename"
            return 0
        else
            log_error "❌ Failed to ingest: $filename"
            return 1
        fi
    else
        log_error "Intake script not found or not executable: $INTAKE_SCRIPT"
        return 1
    fi
}

# Main ingestion function
main() {
    log_title "ChittyOS Evidence Ingestion Starting"

    # Validate directories
    if [ ! -d "$CHITTYOS_DATA" ]; then
        log_error "ChittyOS data directory not found: $CHITTYOS_DATA"
        exit 1
    fi

    if [ ! -d "$CASE_DATA" ]; then
        log_error "Case data directory not found: $CASE_DATA"
        exit 1
    fi

    # Count files to process
    local total_files=0
    local processed_files=0
    local failed_files=0

    log_info "Scanning case directory for priority evidence..."

    # Process PDF files first (legal documents)
    while IFS= read -r -d '' file; do
        filename="$(basename "$file")"

        if is_priority_evidence "$filename"; then
            total_files=$((total_files + 1))
            log_warn "🎯 Priority evidence found: $filename"

            if ingest_file "$file"; then
                processed_files=$((processed_files + 1))
            else
                failed_files=$((failed_files + 1))
            fi
        fi
    done < <(find "$CASE_DATA" -name "*.pdf" -type f -print0)

    # Process key spreadsheet/CSV files
    while IFS= read -r -d '' file; do
        filename="$(basename "$file")"

        if [[ "$filename" =~ (general-ledger|Inventory|Capital|Timeline) ]]; then
            total_files=$((total_files + 1))
            log_warn "📊 Financial document found: $filename"

            if ingest_file "$file"; then
                processed_files=$((processed_files + 1))
            else
                failed_files=$((failed_files + 1))
            fi
        fi
    done < <(find "$CASE_DATA" -name "*.xlsx" -o -name "*.csv" -type f -print0)

    # Summary
    log_title "Evidence Ingestion Complete"
    log_info "Total files scanned: $total_files"
    log_info "Successfully processed: $processed_files"
    if [ $failed_files -gt 0 ]; then
        log_warn "Failed to process: $failed_files"
    fi

    # Show ChittyOS data status
    if [ -f "$CHITTYOS_DATA/ARIAS_V_BIANCHI_TIMELINE.md" ]; then
        log_info "Case timeline available in ChittyOS-Data"
    fi

    log_title "Evidence now available for ChittyChat platform processing"
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi