# skeleton-mcp

Node.js MCP skeleton with:
- Vault-backed secret management
- Postgres-backed configuration management
- Security and operational defaults for production-style patterns

## Purpose

This repository is a starter template for building an MCP server that needs:
- Secret reads and writes through Vault
- Config reads and writes through Postgres
- Tool-level authorization for mutating operations
- Redacted tool output by default
- Basic reliability controls for external secret writes

## Skeleton Architecture

Runtime flow:
1. [src/index.js](src/index.js) boots the app, creates services, and connects MCP stdio transport.
2. [src/config/env.js](src/config/env.js) loads and validates environment configuration.
3. [src/services/configStore.js](src/services/configStore.js) handles Postgres persistence.
4. [src/services/vault.js](src/services/vault.js) handles Vault operations and write retry queue.
5. [src/services/security.js](src/services/security.js) redacts sensitive fields.
6. [src/mcp/server.js](src/mcp/server.js) registers MCP tools and applies auth/error wrappers.

Local infrastructure:
- [docker-compose.yml](docker-compose.yml) runs Postgres and Vault for local development.
- [initdb/001_config.sql](initdb/001_config.sql) creates and seeds the app_config table.

## Tool Catalog

Read-only tools:
- connection_info
- vault_connection_info
- healthcheck
- list_configs
- get_config
- list_secrets
- get_secret

Mutating tools:
- set_config
- delete_config
- set_secret
- delete_secret

If MCP_ADMIN_AUTH_KEY is configured, mutating tools require authorizationKey.

## Security Behavior

- Sensitive fields are redacted unless MCP_ALLOW_SENSITIVE_OUTPUT=true.
- Mutating operations can be access controlled with MCP_ADMIN_AUTH_KEY.
- Vault write operations are serialized through an internal queue and retried with exponential backoff.

## Environment Variables

Core:
- MCP_SERVER_NAME
- MCP_SERVER_VERSION
- MCP_ALLOW_SENSITIVE_OUTPUT
- MCP_ADMIN_AUTH_KEY

Postgres:
- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD

Vault:
- VAULT_ADDR
- VAULT_TOKEN
- VAULT_KV_MOUNT
- VAULT_WRITE_RETRY_ATTEMPTS
- VAULT_WRITE_RETRY_BASE_DELAY_MS
- VAULT_WRITE_RETRY_MAX_DELAY_MS

Reference values are in [.env.example](.env.example).

## Quick Start

1. Install dependencies.
2. Copy .env.example to .env.
3. Start local services with docker compose up -d.
4. Seed a test secret in Vault.
5. Start the MCP server with npm start.
6. Run tests with npm test.

## Vault Production Migration (Raft)

The repository now includes a Vault production migration scaffold under [vault-production](vault-production):

- [vault-production/config/vault.hcl](vault-production/config/vault.hcl): Raft-backed Vault server configuration.
- [vault-production/docker-compose.vault-prod.yml](vault-production/docker-compose.vault-prod.yml): Compose definition for Vault in server mode (non-dev).
- [vault-production/scripts/convert-dev-to-prod.sh](vault-production/scripts/convert-dev-to-prod.sh): Script to export dev KV data, start Raft Vault, initialize/unseal, and import secrets.
- [vault-production/scripts/bootstrap-post-conversion.sh](vault-production/scripts/bootstrap-post-conversion.sh): Script to enable audit, write policy, configure AppRole, and emit service credentials.
- [vault-production/README.md](vault-production/README.md): Detailed migration notes and options.

Run the conversion:

```bash
bash vault-production/scripts/convert-dev-to-prod.sh --init-keys-out vault-production/backups/vault-init.json
```

Common options:

```bash
# Use a different KV mount
bash vault-production/scripts/convert-dev-to-prod.sh --mount secret

# Migrate infra only (skip data movement)
bash vault-production/scripts/convert-dev-to-prod.sh --skip-export --skip-import

# Use when Raft Vault is already initialized
bash vault-production/scripts/convert-dev-to-prod.sh --skip-init

# Post-conversion hardening bootstrap (audit, policy, AppRole)
bash vault-production/scripts/bootstrap-post-conversion.sh --vault-token <root_or_admin_token>

# CI-friendly machine output
bash vault-production/scripts/bootstrap-post-conversion.sh \
	--vault-token <root_or_admin_token> \
	--output json
```

## VS Code Agent Structure

This repository includes a project agent structure for adapting the skeleton to additional service-backed MCP implementations:

- [agent/README.md](agent/README.md): Overview of agent assets.
- [agent/playbooks/service-onboarding.md](agent/playbooks/service-onboarding.md): Step-by-step onboarding checklist.
- [agent/templates/service-spec.md](agent/templates/service-spec.md): Request template for describing new service integrations.

Workspace custom agent:

- [.github/agents/skeleton-services-mcp.agent.md](.github/agents/skeleton-services-mcp.agent.md)
- [.github/prompts/adapt-skeleton-service.prompt.md](.github/prompts/adapt-skeleton-service.prompt.md)

Use this custom agent when you want GitHub Copilot in VS Code to:

1. Configure new service adapters under `src/services`.
2. Register matching MCP tools in `src/mcp/server.js`.
3. Update env validation in `src/config/env.js`.
4. Preserve authorization and redaction behavior.
5. Add tests and documentation updates.

## Test Coverage

Integration tests in [tests/server.integration.test.js](tests/server.integration.test.js) cover:
- Healthcheck behavior
- Authorization on mutating tools
- Redaction behavior for secret output

Production migration tests in [tests/vault-production.test.js](tests/vault-production.test.js) cover:
- Presence of Vault production scaffold files
- Raft config expectations
- Non-dev Vault compose command validation
- Conversion/bootstrap script help and bash syntax checks

## Extend The Skeleton

1. Add domain services under src/services.
2. Register new tools in src/mcp/server.js.
3. Add corresponding tests under tests.
4. Keep mutating tools behind authorization checks.
5. Keep secret-bearing fields redacted by default.

## Notes

- Vault runs in dev mode in docker-compose.yml and is not production-safe.
- The migration scaffold starts with bootstrap-friendly defaults and still requires TLS, production auth methods, and credential rotation before real production use.
