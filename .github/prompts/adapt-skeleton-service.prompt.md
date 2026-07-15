---
mode: agent
tools: ["codebase", "editFiles", "search", "testFailure"]
description: "Adapt this skeleton into an MCP for a specific service with env config, service adapter, tools, tests, and docs updates."
---

Use the Skeleton Services MCP Configurator agent to implement a service integration in this repository.

Collect and use this service spec:

- Service name:
- Purpose:
- Base URL / endpoint style:
- Authentication mechanism:
- Read-only operations:
- Mutating operations:
- Sensitive fields:
- Retry/timeouts:
- Transport requirements (stdio/http/both):
- HTTP auth mode (token/oauth2/both):
- Config scope (default user only vs multi-user):
- Vault token lifecycle methods needed (lookup/renew/create/revoke/revoke-self):
- Vault Agent token sink path and read exposure requirements:
- Rotation time defaults and user override requirements:

Implementation requirements:

1. Add or update environment validation in src/config/env.js.
2. Add a service adapter in src/services.
3. Register tools in src/mcp/server.js with authorizationKey required for mutating tools.
4. Preserve redaction behavior for sensitive fields.
5. Wire dependencies in src/index.js and src/http/index.js when applicable.
6. Preserve transport behavior for stdio/http/both when touched.
7. Keep secrets in Vault and configuration data in Postgres unless explicitly requested otherwise.
8. For config-related changes, preserve multi-user scope with default user fallback.
9. For HTTP token auth changes, preserve Vault token index default-user fallback behavior.
10. If Vault token lifecycle operations are requested, expose MCP tools for tokenLookupSelf, tokenRenewSelf, tokenCreate, tokenRevoke, tokenRevokeSelf.
11. If Vault Agent is requested, wire token sink file reading support and expose an MCP tool for application consumption.
12. If Vault Agent runtime resolution is touched, add tests that cover listener mode, both mode, and invalid-db-mode env fallback behavior.
13. If rotation settings are requested, add both default and user-scoped rotation-time configuration paths.
14. Add tests in tests/*.test.js for happy path, auth failures, redaction behavior, and transport behavior when touched.
15. Update README.md tool catalog and env variable docs.
16. Run npm test and report results.

Constraints:

- Keep changes minimal and aligned with repository style.
- Do not weaken auth or redaction safeguards.
