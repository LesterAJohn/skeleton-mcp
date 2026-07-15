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
