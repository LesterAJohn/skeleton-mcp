# Service Spec Template

Use this template to describe a service integration request.

## Service Overview

- Service name:
- Purpose:
- Base URL / endpoint style:
- Authentication mechanism:
- Transport mode (`stdio`, `http`, `both`):
- HTTP auth mode (`token`, `oauth2`, `both`) when HTTP is used:
- Vault token lifecycle methods to expose:
- Vault Agent token sink read requirement:
- Bearer-token seeding requirements (CLI helper, MCP tool, authorization controls):
- OAuth token seeding requirements (CLI helper, MCP tool, token persistence shape):

## Operations

### Read-only Operations

- Name:
- Inputs:
- Output shape:

### Mutating Operations

- Name:
- Inputs:
- Output shape:
- Authorization requirements:

## Reliability

- Retry policy:
- Timeouts:
- Rate limits:

## Security

- Sensitive fields:
- Redaction expectations:
- Audit requirements:
- Secret storage location (Vault path and shape):
- Managed unseal key source (`VAULT_UNSEAL_KEY` vs file fallback) expectations:
- Startup helper requirements (`vault-unseal-key-init` and compose ordering):
- External Vault/Postgres support requirements (app-only compose, required env vars):
- App-name source of truth requirements (`APP_NAME` -> derived Vault/Postgres names):

## Data Model

- Config scope (global or per-user):
- Default user behavior:
- Future default parameters required:
- Rotation time default value:
- Rotation time user override fields:

## MCP Mapping

- Proposed MCP tool names:
- Validation schema requirements:
- Expected error behavior:
- If bearer-token seeding is requested, include the token index path, token metadata fields, and required admin authorization behavior.
- If OAuth token seeding is requested, include the token index path, required provided token input, and any metadata fields that should be persisted.
