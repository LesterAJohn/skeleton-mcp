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

Implementation requirements:

1. Add or update environment validation in src/config/env.js.
2. Add a service adapter in src/services.
3. Register tools in src/mcp/server.js with authorizationKey required for mutating tools.
4. Preserve redaction behavior for sensitive fields.
5. Wire dependencies in src/index.js.
6. Add tests in tests/*.test.js for happy path, auth failures, and redaction behavior.
7. Update README.md tool catalog and env variable docs.
8. Run npm test and report results.

Constraints:

- Keep changes minimal and aligned with repository style.
- Do not weaken auth or redaction safeguards.
