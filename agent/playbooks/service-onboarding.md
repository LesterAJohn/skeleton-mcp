# Service Onboarding Playbook

Use this checklist when adapting the skeleton for a new service.

## 1. Service Contract

- Define required operations (read-only and mutating).
- Define auth method and required environment variables.
- Identify sensitive fields for redaction.

## 2. Configuration

- Add env parsing and validation in `src/config/env.js`.
- Add defaults only for local development-safe values.
- Keep production-sensitive values required.

## 3. Service Adapter

- Add a service adapter in `src/services`.
- Encapsulate API/client behavior and retries in the adapter.
- Expose a `healthcheck` method when applicable.

## 4. MCP Tool Registration

- Register tools in `src/mcp/server.js`.
- Route read-only operations without admin key.
- Protect mutating operations with `authorizationKey` checks.
- Keep tool responses JSON-serializable and redactable.

## 5. Runtime Wiring

- Wire adapter construction in `src/index.js`.
- Pass adapter into `createMcpServer` dependencies.

## 6. Tests

- Add integration tests under `tests`.
- Cover auth gates for mutating tools.
- Cover redaction behavior for sensitive fields.
- Cover unhappy paths and error responses.

## 7. Operations

- Update README tool catalog and environment variable docs.
- If infra changes are required, update compose files and migration assets.
- Keep production hardening notes explicit.
