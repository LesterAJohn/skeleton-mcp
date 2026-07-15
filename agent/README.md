# Agent Structure

This directory stores project-specific playbooks used by the workspace custom agent for adapting this skeleton into MCP servers for additional services.

## Contents

- `playbooks/service-onboarding.md`: Step-by-step checklist for adding a new service integration to the MCP skeleton.
- `templates/service-spec.md`: Structured input template for describing a new service integration request.
- `.github/prompts/adapt-skeleton-service.prompt.md`: Agent-mode prompt for running structured service adaptation tasks from chat.

## How It Is Used

The VS Code custom agent at `.github/agents/skeleton-services-mcp.agent.md` uses this material as implementation guidance when asked to:

- Add a new external service integration
- Expose service operations as MCP tools
- Keep security defaults (redaction and authorization)
- Preserve dual transport behavior (stdio and HTTP)
- Preserve HTTP auth modes (token, oauth2, both)
- Keep secrets in Vault and config in Postgres
- Maintain multi-user defaults (Vault token fallback user and Postgres config default user)
- Add tests and documentation updates
