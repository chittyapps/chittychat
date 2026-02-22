# ChittyChat Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/chittychat`
- **Tier**: 5 (Application)
- **Organization**: chittyapps
- **Domain**: chittychat.chitty.cc

## Mission

Chat and messaging service for the ChittyOS ecosystem. Provides real-time communication capabilities.

## Scope

### IS Responsible For
- Real-time chat, messaging, conversation management, session persistence

### IS NOT Responsible For
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |

## API Contract

**Base URL**: https://chittychat.chitty.cc

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health |

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |

## Compliance

- [ ] Registered in ChittyRegister
- [ ] Health endpoint operational at /health
- [ ] CLAUDE.md present
- [ ] CHARTER.md present
- [ ] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-21*