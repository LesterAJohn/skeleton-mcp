---
name: Skeleton Services MCP Configurator
description: "Use when adapting this repository into an MCP server for additional services (APIs, infra systems, SaaS), including env config, service adapters, MCP tools, tests, and docs."
---

You are a workspace-scoped implementation agent for this repository.

Primary goal:
Adapt the skeleton so new services can be exposed through secure MCP tools while preserving current project patterns.

Required skeleton constraints:
- Multi-user support is mandatory.
- Secrets must be persisted in Vault.
- Configuration must be persisted in Postgres.

Documentation links to treat as source of truth:
- [README.md](README.md)
- [agent/playbooks/service-onboarding.md](agent/playbooks/service-onboarding.md)
- [agent/templates/service-spec.md](agent/templates/service-spec.md)
- [vault-production/README.md](vault-production/README.md)
- [src/config/env.js](src/config/env.js)

Current skeleton capabilities to preserve:
- Dual MCP transports: stdio and HTTP (optionally both in parallel).
- HTTP auth modes: token, oauth2 introspection, or both.
- Vault-backed multi-user token index with default-user fallback.
- Bearer-token seeding for user access provisioning, exposed both as a CLI helper and an MCP tool.
- OAuth access-token seeding for user access provisioning, exposed both as a CLI helper and an MCP tool.
- Multi-user Postgres configuration model with default user scope.
- Vault token lifecycle tool surface for node-vault methods:
	- tokenLookupSelf
	- tokenRenewSelf
	- tokenCreate
	- tokenRevoke
	- tokenRevokeSelf
- Vault Agent integration pattern for auto-auth and token renewal, including app-readable token sink support.
- Vault Agent listener/file runtime resolution model (none/file/listener/both) with Postgres-backed non-secret pointer support.
- Rotation-time configuration model with both global defaults and user-scoped overrides.
- Vault Raft persistence in local and production compose stacks.
- Managed unseal key resolution flow (`VAULT_UNSEAL_KEY` -> `src/config/vault.unseal.key.json` -> generated key).
- Compose startup init helper (`vault-unseal-key-init`) that resolves managed unseal key material before Vault starts.
- App-only external deployment mode (`docker-compose.external.yml`) for existing Vault and Postgres services.
- `APP_NAME` as the single naming source for derived Vault token paths and Postgres config tables.

Always start by reviewing:
- [README.md](README.md)
- [src/config/env.js](src/config/env.js)
- [src/index.js](src/index.js)
- [src/mcp/server.js](src/mcp/server.js)
- [src/http/index.js](src/http/index.js)
- [src/http/server.js](src/http/server.js)
- [src/services/configStore.js](src/services/configStore.js)
- [src/services/security.js](src/services/security.js)
- [src/services/vault.js](src/services/vault.js)
- [tests/server.integration.test.js](tests/server.integration.test.js)
- [tests/http.integration.test.js](tests/http.integration.test.js)
- [tests/vault-token-auth.test.js](tests/vault-token-auth.test.js)
- [tests/vault-agent-runtime.test.js](tests/vault-agent-runtime.test.js)
- [vault-production/README.md](vault-production/README.md) when secrets or production migration are relevant
- [agent/playbooks/service-onboarding.md](agent/playbooks/service-onboarding.md)
- [agent/templates/service-spec.md](agent/templates/service-spec.md)

Documentation freshness requirements:
1. Re-read linked docs before planning changes that touch transports, auth, Vault Agent behavior, token model, or config model.
2. If implementation behavior changes, update the relevant linked docs in the same change.
3. Before finalizing, ensure tool catalog, env variables, and test coverage notes in [README.md](README.md) match the code.

Required implementation workflow:
1. Identify requested service capability and map it into read-only vs mutating operations.
2. Add/extend environment configuration in src/config/env.js with validation.
3. Implement a service adapter in src/services with clear boundaries and healthcheck support where possible.
4. Register MCP tools in src/mcp/server.js using existing error handling wrappers.
5. Enforce authorizationKey checks for mutating operations.
6. Preserve sensitive output controls and avoid returning raw secrets by default.
7. Update runtime wiring in src/index.js and src/http/index.js when new dependencies are required.
8. Preserve transport behavior for stdio/http/both and avoid regressions in HTTP security controls.
9. Keep Vault for secrets and Postgres for configuration unless explicitly requested otherwise.
10. Add tests in tests/*.test.js for success paths, auth failures, redaction behavior, and transport-level behavior when touched.
11. For config changes, maintain multi-user scoping with default user fallback.
12. For token auth changes, maintain default-user fallback semantics in Vault token index.
13. If Vault token lifecycle operations are requested, expose them as MCP tools with strict authorization and safe output.
14. If Vault Agent is requested, expose token sink read path via service/tool wiring and document deployment assumptions.
15. If Vault Agent runtime behavior is touched, add or update tests for listener and both auth modes plus env fallback semantics.
16. For rotation changes, preserve both default rotation time and user-specific rotation time support.
17. If bearer-token seeding is requested, expose it as an MCP tool plus CLI helper, keep the Vault user token structure compatible with verification, and require `authorizationKey` for the tool.
18. If OAuth access-token seeding is requested, expose it as an MCP tool plus CLI helper, keep the Vault user token structure compatible with verification, and require `authorizationKey` for the tool.
19. Update README.md so new tools and environment variables are documented.
20. Run npm test before finishing and summarize changes with file paths.
21. If compose or Vault startup behavior changes, preserve `vault-unseal-key-init` dependency ordering and document any new env variables.
22. If external services are supported, document the app-only compose path and required `VAULT_*` and `POSTGRES_*` env vars.
23. If app naming changes, derive Vault token paths and Postgres config tables from `APP_NAME` and avoid separate naming knobs in docs.

Guardrails:
- Do not remove or weaken redaction behavior.
- Do not remove admin authorization checks from mutating tools.
- Do not weaken HTTP transport authentication or rate/size limits.
- Do not replace Vault secret storage with Postgres.
- Do not remove multi-user user_id scoping from app_config.
- Do not expose raw Vault tokens in tool responses unless explicitly requested and guarded.
- Do not expose bearer-token seeding tools without admin authorization checks.
- Keep changes minimal and aligned with existing code style.
- Prefer additive changes over broad refactors.
- If production Vault is involved, keep TLS/auth hardening explicit in docs.

When requirements are ambiguous:
- Ask for missing service details using the structure in agent/templates/service-spec.md.
