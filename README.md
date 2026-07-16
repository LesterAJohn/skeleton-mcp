# teslamate-mcp

MCP server built from skeleton-mcp that exposes TeslaMate HTTP APIs.

## What This Server Exposes

TeslaMate endpoints covered by dedicated tools:
- `GET /health_check`
- `PUT /api/car/:id/logging/suspend`
- `PUT /api/car/:id/logging/resume`
- `GET /drive/:id/gpx`

Additional MCP tools:
- `teslamate_connection_info`
- `teslamate_list_endpoints`
- `teslamate_api_request` (generic passthrough to support all currently available TeslaMate routes)

## Tool Catalog

- `teslamate_connection_info`
  - Returns MCP and TeslaMate connection/auth configuration status (without leaking secrets).

- `teslamate_list_endpoints`
  - Returns the currently known TeslaMate routes from TeslaMate docs/source.

- `teslamate_health_check`
  - Calls `GET /health_check`.

- `teslamate_suspend_logging`
  - Calls `PUT /api/car/:id/logging/suspend`.
  - Requires `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is configured.

- `teslamate_resume_logging`
  - Calls `PUT /api/car/:id/logging/resume`.
  - Requires `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is configured.

- `teslamate_get_drive_gpx`
  - Calls `GET /drive/:id/gpx`.

- `teslamate_api_request`
  - Generic TeslaMate request tool with method/path/query/body/headers support.
  - Uses the configured TeslaMate base URL and auth mode.
  - Mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) require `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is configured.

## Environment

Copy `.env.example` to `.env` and set at least:

- `TESLAMATE_BASE_URL` (default `http://127.0.0.1:4000`)
- `TESLAMATE_AUTH_MODE` (`none`, `bearer`, or `basic`)
- `TESLAMATE_BEARER_TOKEN` if using bearer auth
- `TESLAMATE_BASIC_USERNAME` and `TESLAMATE_BASIC_PASSWORD` if using basic auth

Optional security control for mutating MCP operations:
- `MCP_ADMIN_AUTH_KEY`

## Run

Install dependencies:

```bash
npm install
```

Start stdio MCP server:

```bash
npm run start:stdio
```

Start HTTP MCP server:

```bash
npm run start:http
```

## External Services Mode

This project still includes `docker-compose.external.yml` for app-only runs that point to external services. If you use that mode, configure at least `POSTGRES_HOST` and `VAULT_ADDR` in your environment before launching the compose file.

## Notes On TeslaMate API Coverage

TeslaMate's native JSON API surface is intentionally small. This MCP includes dedicated tools for all known API-style endpoints and adds `teslamate_api_request` so new/instance-specific routes can be accessed without waiting for a code change.
