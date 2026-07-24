# skeleton-mcp

Node.js MCP skeleton with:
- Vault-backed secret management
- Postgres-backed configuration management
- Security and operational defaults for production-style patterns

## Purpose

This repository is a starter template for building an MCP server that needs:
- Multi-user support.
- Secret reads and writes through Vault
- Config reads and writes through Postgres
- Tool-level authorization for mutating operations
- Redacted tool output by default
- Basic reliability controls for external secret writes

Design requirements:
- Secrets are persistent in Vault.
- Configuration is persistent in Postgres.
- User-scoped behavior is mandatory, with default-user fallback where supported.

## Skeleton Architecture

Runtime flow:
1. [src/index.js](src/index.js) boots the app, creates services, and connects MCP stdio transport.
2. [src/config/env.js](src/config/env.js) loads and validates environment configuration.
3. [src/services/configStore.js](src/services/configStore.js) handles Postgres persistence.
4. [src/services/vault.js](src/services/vault.js) handles Vault operations and write retry queue.
5. [src/services/security.js](src/services/security.js) redacts sensitive fields.
6. [src/mcp/server.js](src/mcp/server.js) registers MCP tools and applies auth/error wrappers.
7. [src/http/server.js](src/http/server.js) exposes MCP over HTTP with auth, limits, and access logs.
8. [src/http/index.js](src/http/index.js) boots the dedicated HTTP MCP process.
9. [src/start-both.js](src/start-both.js) starts stdio and HTTP as separate child processes.

Local infrastructure:
- [docker-compose.yml](docker-compose.yml) runs Postgres and Vault for local development.
- [docker-compose.external.yml](docker-compose.external.yml) runs only the MCP app against external Postgres and Vault services.
- [initdb/001_config.sh](initdb/001_config.sh) creates and seeds the app-prefixed config table.

## Registering The MCP Server

This repository can be registered with MCP clients in either stdio mode or HTTP mode.

For local development, stdio is the simplest option:

```json
{
	"mcpServers": {
		"skeleton-mcp": {
			"command": "npm",
			"args": ["run", "start:stdio"],
			"cwd": "/Users/lesterjohn/Documents/GitHub/skeleton-mcp"
		}
	}
}
```

For HTTP-capable clients, use `npm run start:http` and point the client at the `/mcp` endpoint.

### Codex

Use stdio for Codex unless you specifically need HTTP. Add the server to your Codex MCP configuration using the local workspace path:

- Config file: `~/.codex/config.toml`
- Transport: stdio

```json
{
	"mcpServers": {
		"skeleton-mcp": {
			"command": "npm",
			"args": ["run", "start:stdio"],
			"cwd": "/Users/lesterjohn/Documents/GitHub/skeleton-mcp"
		}
	}
}
```

If you prefer HTTP, run `npm run start:http` in this repository and configure Codex to send MCP requests to `http://127.0.0.1:3000/mcp`.

### VS Code

Use stdio in VS Code for local workspace access, or HTTP if your setup routes MCP servers over a local endpoint:

- Config file: `.vscode/mcp.json`
- Transport: stdio or HTTP

```json
{
	"command": "npm",
	"args": ["run", "start:stdio"],
	"cwd": "/Users/lesterjohn/Documents/GitHub/skeleton-mcp"
}
```

If your VS Code setup uses HTTP transport, point it at `http://127.0.0.1:3000/mcp` after starting `npm run start:http`.

### Claude

For Claude Desktop, use stdio and add an MCP server entry that launches the process from this repository:

- Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Transport: stdio

```json
{
	"mcpServers": {
		"skeleton-mcp": {
			"command": "npm",
			"args": ["run", "start:stdio"],
			"cwd": "/Users/lesterjohn/Documents/GitHub/skeleton-mcp"
		}
	}
}
```

If you are using a Claude setup that supports MCP over HTTP, point it at `http://127.0.0.1:3000/mcp`.

## Tool Catalog

Read-only tools:
- connection_info
- vault_connection_info
- healthcheck
- list_configs
- get_config
- list_secrets
- get_secret
- vault_agent_token_read
- token_lookup_self
- token_rotation_config

Mutating tools:
- set_config
- delete_config
- set_secret
- delete_secret
- token_renew_self
- token_create
- token_revoke
- token_revoke_self

If MCP_ADMIN_AUTH_KEY is configured, mutating tools require authorizationKey.

## Security Behavior

- Sensitive fields are redacted unless MCP_ALLOW_SENSITIVE_OUTPUT=true.
- Mutating operations can be access controlled with MCP_ADMIN_AUTH_KEY.
- Vault write operations are serialized through an internal queue and retried with exponential backoff.

## Environment Variables

Core:
- APP_NAME
- MCP_SERVER_NAME
- MCP_SERVER_VERSION
- MCP_ALLOW_SENSITIVE_OUTPUT
- MCP_ADMIN_AUTH_KEY
- MCP_TRANSPORT_MODE (`stdio`, `http`, or `both`)
- MCP_CONFIG_DEFAULT_USER_ID
- MCP_TOKEN_ROTATION_DEFAULT_INTERVAL_MS
- MCP_TOKEN_ROTATION_USER_INTERVAL_CONFIG_KEY
- MCP_VAULT_AGENT_AUTH_MODE_CONFIG_KEY
- MCP_VAULT_AGENT_TOKEN_FILE_PATH_CONFIG_KEY
- MCP_VAULT_AGENT_LISTENER_ADDR_CONFIG_KEY

HTTP transport:
- MCP_HTTP_HOST
- MCP_HTTP_PORT
- MCP_HTTP_PATH
- MCP_HTTP_HEALTH_PATH
- MCP_HTTP_AUTH_MODE (`token`, `oauth2`, `both`)
- MCP_HTTP_TOKEN_SOURCE (`vault`, `env`)
- MCP_HTTP_AUTH_TOKENS (comma-separated bearer tokens)
- MCP_HTTP_TRUST_PROXY
- MCP_HTTP_ALLOWED_ORIGINS (comma-separated)
- MCP_HTTP_ALLOWED_IPS (comma-separated)
- MCP_HTTP_MAX_BODY_BYTES
- MCP_HTTP_RATE_LIMIT_WINDOW_MS
- MCP_HTTP_RATE_LIMIT_MAX_REQUESTS
- MCP_HTTP_VAULT_TOKEN_INDEX_PATH
- MCP_HTTP_VAULT_TOKEN_DEFAULT_USER_ID
- MCP_HTTP_VAULT_TOKEN_REQUIRED_SCOPES
- MCP_HTTP_VAULT_TOKEN_REQUIRED_AUDIENCE
- MCP_HTTP_VAULT_TOKEN_CACHE_TTL_MS
- MCP_HTTP_OAUTH2_INTROSPECTION_URL
- MCP_HTTP_OAUTH2_CLIENT_ID
- MCP_HTTP_OAUTH2_CLIENT_SECRET
- MCP_HTTP_OAUTH2_REQUIRED_SCOPES
- MCP_HTTP_OAUTH2_REQUIRED_AUDIENCE
- MCP_HTTP_OAUTH2_TIMEOUT_MS
- MCP_HTTP_OAUTH2_CACHE_TTL_MS
- MCP_HTTP_TLS_ENABLED
- MCP_HTTP_TLS_CERT_PATH
- MCP_HTTP_TLS_KEY_PATH

Postgres:
- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD

Postgres config model:

- Configuration data is app-scoped in `${APP_NAME}_config` and user-scoped with composite key `(user_id, key)`.
- MCP config tools accept optional `userId`; when omitted, `MCP_CONFIG_DEFAULT_USER_ID` is used.
- Seed records include:
	- `default/sample.feature`
	- `default/app.defaults` for future default parameters.
	- `default/token.rotation.intervalMs`
	- `default/vault.agent.auth.mode`
	- `default/vault.agent.tokenFilePath`
	- `default/vault.agent.listener.addr`

Vault:
- VAULT_ADDR
- VAULT_TOKEN
- VAULT_AGENT_ENABLED
- VAULT_AGENT_AUTH_MODE (`none`, `file`, `listener`, `both`)
- VAULT_AGENT_TOKEN_FILE_PATH
- VAULT_AGENT_LISTENER_ENABLED
- VAULT_AGENT_LISTENER_ADDR
- VAULT_UNSEAL_KEY
- VAULT_KV_MOUNT
- VAULT_WRITE_RETRY_ATTEMPTS
- VAULT_WRITE_RETRY_BASE_DELAY_MS
- VAULT_WRITE_RETRY_MAX_DELAY_MS

Naming defaults:

- `APP_NAME` defaults to `skeleton`.
- The Postgres config table defaults to `${APP_NAME}_config`.
- The Vault token index path defaults to `${APP_NAME}/users/${MCP_HTTP_VAULT_TOKEN_DEFAULT_USER_ID}/http/auth/token-index`.
- Set only `APP_NAME` to rename the app-scoped Vault/Postgres schema across local and external stores.

Reference values are in [.env.example](.env.example).

## Quick Start

1. Install dependencies.
2. Copy .env.example to .env.
3. Start local services with docker compose up -d.
4. Resolve the managed unseal key: `npm run vault:unseal-key -- --json`.
5. Initialize and unseal local Vault (first run):

```bash
docker exec -e VAULT_ADDR=http://127.0.0.1:8200 skeleton-mcp-vault vault operator init -key-shares=1 -key-threshold=1 -format=json
docker exec -e VAULT_ADDR=http://127.0.0.1:8200 skeleton-mcp-vault vault operator unseal <unseal_key_from_init_or_env>
```

6. Seed a test secret in Vault.
7. Start the MCP server with npm start.
8. Run tests with npm test.

## External Services Mode

Use this mode when Vault and Postgres are already managed outside this repository.

Required environment variables:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `VAULT_ADDR`, `VAULT_TOKEN`

Run the app-only compose stack:

```bash
docker compose -f docker-compose.external.yml up -d
```

Notes:

- The app still uses Vault for secrets and Postgres for config.
- The external stack is the same MCP HTTP container, but it skips local Postgres/Vault containers.
- If you keep Vault sealed, the app will still require whatever unseal process your external Vault uses.

### Test Coverage Notes

Current automation includes listener-related coverage for Vault Agent runtime resolution.

- [tests/vault-agent-runtime.test.js](tests/vault-agent-runtime.test.js) validates:
	- listener mode resolution from Postgres defaults
	- both mode resolution (listener + file)
	- fallback to environment values when database mode is invalid

Transport scripts:

```bash
# stdio only (default)
npm run start:stdio

# HTTP transport only
npm run start:http

# run stdio + HTTP as two processes
npm run start:both
```

## HTTP MCP Endpoint

Default endpoint values:

- MCP URL: `http://127.0.0.1:3000/mcp`
- Health URL: `http://127.0.0.1:3000/healthz`

HTTP transport security controls:

- Every `/mcp` request requires `Authorization: Bearer <token>`.
- For `MCP_HTTP_AUTH_MODE=token`, set `MCP_HTTP_TOKEN_SOURCE=vault` to validate tokens from Vault.
- For `MCP_HTTP_AUTH_MODE=oauth2`, bearer tokens are validated by OAuth2 introspection.
- For `MCP_HTTP_AUTH_MODE=both`, either token strategy can authorize requests.
- Mutating tools still require `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is set.
- Request limits are enforced with:
	- `MCP_HTTP_MAX_BODY_BYTES`
	- `MCP_HTTP_RATE_LIMIT_WINDOW_MS`
	- `MCP_HTTP_RATE_LIMIT_MAX_REQUESTS`
- Optional network restrictions:
	- `MCP_HTTP_ALLOWED_ORIGINS`
	- `MCP_HTTP_ALLOWED_IPS`

### Vault Multi-User Token Model

Store HTTP bearer tokens in Vault at `MCP_HTTP_VAULT_TOKEN_INDEX_PATH`.
If unset, seeding tools default to `${APP_NAME}/users/<user_id>/http/auth/token-index`.

Default-user fallback behavior:

- `MCP_HTTP_VAULT_TOKEN_DEFAULT_USER_ID` defaults to `default`.
- If no non-default users exist in the token index, the default user is always used as fallback.

Supported index shape:

```json
{
	"tokens": {
		"<sha256(token)>": {
			"userId": "user-123",
			"tokenId": "tok-123",
			"active": true,
			"scopes": ["mcp:invoke", "mcp:read"],
			"audience": ["codex", "claude"],
			"expiresAt": "2026-12-31T23:59:59Z"
		}
	}
}
```

Notes:

- Store only token hashes in Vault index data, never plaintext tokens.
- `MCP_HTTP_VAULT_TOKEN_REQUIRED_SCOPES` and `MCP_HTTP_VAULT_TOKEN_REQUIRED_AUDIENCE` enforce policy checks.
- This keeps secrets in Vault under the app-prefixed root while configuration remains in the app-prefixed Postgres table.

### Vault HTTP Token Seeding

Use the helper script to generate an opaque bearer token and store it in the Vault user token structure:

```bash
npm run vault:seed-http-token -- --user-id default --json
```

Useful options:

- `--user-id <id>`: Vault user to seed.
- `--token-id <id>`: Optional token id stored with the entry.
- `--scopes <list>`: Comma or space separated scopes.
- `--audience <list>`: Comma or space separated audience values.
- `--expires-at <value>`: Optional ISO timestamp or unix seconds.
- `--path <vault-path>`: Override the token index path.

The script writes the token record under the app-prefixed user structure and mirrors the token in the top-level token map for compatibility.

If you need to reseed a user, run the script again with the same `--user-id` and a new `--token-id`.

### Vault OAuth Token Seeding

Use the helper script to store a provided OAuth access token in the Vault user token structure:

```bash
npm run vault:seed-oauth-token -- --token "$OAUTH_ACCESS_TOKEN" --user-id default --json
```

Useful options:

- `--token <value>`: OAuth access token to seed.
- `--user-id <id>`: Vault user to seed.
- `--token-id <id>`: Optional token id stored with the entry.
- `--scopes <list>`: Comma or space separated scopes.
- `--audience <list>`: Comma or space separated audience values.
- `--expires-at <value>`: Optional ISO timestamp or unix seconds.
- `--path <vault-path>`: Override the token index path.

The script stores the provided token under the app-prefixed user structure, keeps the top-level token map aligned, and marks the entry as `oauth2` in Vault metadata.

### MCP Tool

The same capability is exposed as an MCP tool for controlled setup workflows:

- `vault_seed_http_token`: generate a bearer token and store it in the Vault HTTP token index for a user.
- `vault_seed_oauth_token`: store a provided OAuth access token in the Vault HTTP token index for a user.

For both tools, include app/user scope in requests so clients can reason about target storage:

- `appName` determines app-level namespace defaults.
- `userId` determines user-level namespace under `${APP_NAME}/users/<user_id>/...`.

The tool requires `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is configured.

### Vault Token Lifecycle MCP Tools

The skeleton exposes node-vault token lifecycle methods as MCP tools:

- `token_lookup_self` -> `tokenLookupSelf`
- `token_renew_self` -> `tokenRenewSelf`
- `token_create` -> `tokenCreate`
- `token_revoke` -> `tokenRevoke`
- `token_revoke_self` -> `tokenRevokeSelf`

These tools are intended for controlled operational usage and are guarded by admin authorization when `MCP_ADMIN_AUTH_KEY` is configured.

### Vault Agent Auto-Auth and Token Renewal

Vault Agent can own token auth/renewal while this service reads the sink token file.

- Enable with `VAULT_AGENT_ENABLED=true`
- Choose auth mode with `VAULT_AGENT_AUTH_MODE`:
	- `file`: use Vault Agent token sink file
	- `listener`: use Vault Agent listener endpoint
	- `both`: enable listener operations and file-based token read workflows
- Configure sink file path with `VAULT_AGENT_TOKEN_FILE_PATH`
- Enable listener with `VAULT_AGENT_LISTENER_ENABLED=true`
- Configure listener with `VAULT_AGENT_LISTENER_ADDR`
- Use `vault_agent_token_read` when application workflows need token sink visibility

When Vault Agent mode is enabled:

- File mode refreshes token state from the configured token sink path.
- Listener mode routes Vault operations through the configured Vault Agent listener.
- Both mode supports listener operations and token sink read workflows.

### Option 3: Postgres-Backed Non-Secret Vault Agent Settings

This skeleton supports storing non-secret Vault Agent runtime pointers/settings in Postgres while keeping token material in Vault.

- Runtime settings are read from default user config scope (`MCP_CONFIG_DEFAULT_USER_ID`).
- Key names are configurable with:
	- `MCP_VAULT_AGENT_AUTH_MODE_CONFIG_KEY`
	- `MCP_VAULT_AGENT_TOKEN_FILE_PATH_CONFIG_KEY`
	- `MCP_VAULT_AGENT_LISTENER_ADDR_CONFIG_KEY`
- Recommended values in Postgres:
	- `vault.agent.auth.mode`
	- `vault.agent.tokenFilePath`
	- `vault.agent.listener.addr`

### Rotation Time Configuration

Rotation interval supports both global defaults and user-scoped overrides:

- Global default env variable: `MCP_TOKEN_ROTATION_DEFAULT_INTERVAL_MS`
- User-scoped config key name: `MCP_TOKEN_ROTATION_USER_INTERVAL_CONFIG_KEY` (default `token.rotation.intervalMs`)

Effective value resolution is:

1. User-scoped Postgres config (`userId` + key)
2. Default user Postgres config (`default` + key)
3. Global env default

Use `token_rotation_config` tool to inspect the resolved rotation interval for a user scope.

Minimal remote call example:

```bash
curl -i http://127.0.0.1:3000/mcp \
	-H "Authorization: Bearer replace-me-token" \
	-H "Accept: application/json, text/event-stream" \
	-H "Content-Type: application/json" \
	-d '{
		"jsonrpc": "2.0",
		"id": 1,
		"method": "initialize",
		"params": {
			"protocolVersion": "2025-11-25",
			"capabilities": {},
			"clientInfo": { "name": "client", "version": "1.0.0" }
		}
	}'
```

## HTTPS Deployment Choice

This repository uses a reverse proxy (recommended): terminate TLS at a reverse proxy or load balancer.

- Keep this app on internal HTTP.
- Enforce HTTPS, client allowlists, and edge-level controls at the proxy/LB.
- Forward traffic to `MCP_HTTP_HOST:MCP_HTTP_PORT`.
- Keep `MCP_HTTP_TLS_ENABLED=false` in this process mode.

Popular patterns include Nginx, Traefik, Envoy, ALB/NLB, or Cloudflare Tunnel in front of `/mcp`.

## Vault Production Migration (Raft)

The repository now includes a Vault production migration scaffold under [vault-production](vault-production):

- [vault-production/config/vault.hcl](vault-production/config/vault.hcl): Raft-backed Vault server configuration.
- [vault-production/docker-compose.vault-prod.yml](vault-production/docker-compose.vault-prod.yml): Compose definition for Vault in server mode (non-dev).
- [vault-production/scripts/convert-dev-to-prod.sh](vault-production/scripts/convert-dev-to-prod.sh): Script to export dev KV data, start Raft Vault, initialize/unseal, and import secrets.
- [vault-production/scripts/bootstrap-post-conversion.sh](vault-production/scripts/bootstrap-post-conversion.sh): Script to enable audit, write policy, configure AppRole, and emit service credentials.
- [scripts/vault-unseal-key.js](scripts/vault-unseal-key.js): Script to resolve unseal key from `VAULT_UNSEAL_KEY` or `src/config/vault.unseal.key.json`.
- [vault-production/README.md](vault-production/README.md): Detailed migration notes and options.

Managed unseal key flow:

- `VAULT_UNSEAL_KEY` is optional and can be injected at runtime.
- If `VAULT_UNSEAL_KEY` is not set, `npm run vault:unseal-key` reads `src/config/vault.unseal.key.json`.
- If the key file is missing or empty, a 24-character key is generated and saved to `src/config/vault.unseal.key.json`.
- Both compose stacks run a one-shot `vault-unseal-key-init` service before Vault startup to ensure key material exists.

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

# Explicitly set key file path used by convert script
bash vault-production/scripts/convert-dev-to-prod.sh --unseal-key-path src/config/vault.unseal.key.json

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

HTTP transport tests in [tests/http.integration.test.js](tests/http.integration.test.js) cover:
- Unauthorized requests are rejected
- Authorized MCP initialization succeeds
- Internal failures return JSON-RPC-compatible error responses
- Health endpoint behavior

Vault token auth tests in [tests/vault-token-auth.test.js](tests/vault-token-auth.test.js) cover:
- Multi-user token index lookup by SHA-256 hash
- Inactive token rejection
- Scope/audience-aware authorization inputs

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

- docker-compose.yml now runs Vault with Raft-backed storage for local persistence.
- The managed key script is an automation helper and not a Vault KMS/HSM auto-unseal backend.
- The migration scaffold starts with bootstrap-friendly defaults and still requires TLS, production auth methods, and credential rotation before real production use.
