---
mode: agent
tools: ["codebase", "editFiles", "search", "testFailure"]
description: "Adapt this skeleton into an MCP for a specific service with env config, service adapter, tools, tests, and docs updates."
---

Use the Skeleton Services MCP Configurator agent to implement a service integration in this repository.

Documentation links to treat as source of truth:

- [README.md](README.md)
- [agent/playbooks/service-onboarding.md](agent/playbooks/service-onboarding.md)
- [agent/templates/service-spec.md](agent/templates/service-spec.md)
- [vault-production/README.md](vault-production/README.md)
- [src/config/env.js](src/config/env.js)

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

If bearer-token or OAuth token seeding for user access setup is requested, treat it as a mutating capability that must be exposed through a guarded MCP tool and, if useful, a matching CLI helper.

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
17. If Vault or compose startup is touched, preserve Raft persistence and `vault-unseal-key-init` startup ordering.
18. Keep managed unseal key flow aligned with docs (`VAULT_UNSEAL_KEY` then file fallback then generate).
19. If the repo supports external Vault/Postgres services, keep the app-only compose path documented and aligned with env requirements.
20. If app naming is configurable, use `APP_NAME` as the single source for derived Vault and Postgres names.
21. If bearer-token seeding is part of the request, add a guarded MCP tool and, when helpful, a CLI helper that writes the same Vault token index shape.
22. If OAuth token seeding is part of the request, add a guarded MCP tool and, when helpful, a CLI helper that writes the same Vault token index shape.
23. If compose port mappings are touched, keep exposed host ports configurable via env vars with known defaults and document them.

Documentation freshness requirements:

1. Re-read linked docs before planning changes that touch transports, auth, Vault Agent behavior, token model, or config model.
2. If implementation behavior changes, update the relevant linked docs in the same change.
3. Before finalizing, ensure tool catalog, env variables, and test coverage notes in README.md match the code.

Constraints:

- Keep changes minimal and aligned with repository style.
- Do not weaken auth or redaction safeguards.
- Do not add token-seeding capabilities without authorization controls.
