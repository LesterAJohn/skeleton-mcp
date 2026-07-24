# Service Onboarding Playbook

Use this checklist when adapting the skeleton for a new service.

## 1. Service Contract

- Confirm multi-user support is required.
- Define required operations (read-only and mutating).
- Define auth method and required environment variables.
- Identify sensitive fields for redaction.
- Define transport expectations (stdio, http, or both).
- Define whether user-scoped configuration is required.
- Define whether Vault token lifecycle operations are required (lookup/renew/create/revoke/revoke-self).
- Define whether Vault Agent token sink access is required by the application.

## 2. Configuration

- Add env parsing and validation in `src/config/env.js`.
- Add defaults only for local development-safe values.
- Keep production-sensitive values required.
- Persist secrets in Vault and configuration in Postgres.
- For config persistence, preserve multi-user scope with default user fallback.
- When rotation policies are needed, define a default rotation time and per-user override strategy.

## 3. Service Adapter

- Add a service adapter in `src/services`.
- Encapsulate API/client behavior and retries in the adapter.
- Expose a `healthcheck` method when applicable.

## 4. MCP Tool Registration

- Register tools in `src/mcp/server.js`.
- Route read-only operations without admin key.
- Protect mutating operations with `authorizationKey` checks.
- Keep tool responses JSON-serializable and redactable.
- If requested, expose Vault token lifecycle tools using node-vault methods with strict auth guardrails.
- If requested, expose a read tool for Vault Agent token sink material needed by the application.
- If requested, expose bearer-token seeding as a guarded MCP tool and keep the Vault token index shape compatible with the verifier.
- If requested, expose OAuth token seeding as a guarded MCP tool and keep the Vault token index shape compatible with the verifier.

## 5. Runtime Wiring

- Wire adapter construction in `src/index.js`.
- Pass adapter into `createMcpServer` dependencies.
- If HTTP is touched, update `src/http/index.js` and keep auth/limits intact.

## 6. Tests

- Add integration tests under `tests`.
- Cover auth gates for mutating tools.
- Cover redaction behavior for sensitive fields.
- Cover unhappy paths and error responses.
- If HTTP transport is touched, add/maintain transport-level auth behavior tests.
- If Vault token model is touched, preserve default-user fallback tests.
- If Vault Agent runtime resolution is touched, add/maintain listener mode, both mode, and env fallback tests.

## 7. Operations

- Update README tool catalog and environment variable docs.
- If infra changes are required, update compose files and migration assets.
- Preserve Vault Raft persistence in both local and production compose definitions when Vault settings are touched.
- Preserve startup init flow that resolves managed key material before Vault starts (`vault-unseal-key-init`).
- Keep `VAULT_UNSEAL_KEY` and `src/config/vault.unseal.key.json` behavior aligned with docs when unseal workflows are touched.
- Document an app-only compose path for environments where Vault and Postgres are external services.
- Treat `docker-compose.external.yml` as the supported startup shape for external Vault/Postgres deployments.
- Treat `APP_NAME` as the single source of truth for app-prefixed Vault and Postgres names.
- Keep production hardening notes explicit.
