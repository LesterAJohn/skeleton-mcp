# Vault Production Migration (Raft)

This directory contains assets to migrate the local dev Vault setup to a Raft-backed Vault server.

## Structure

- `config/vault.hcl`:
  Vault server config that enables Raft storage at `/vault/data`.
- `docker-compose.vault-prod.yml`:
  Compose service for running Vault with `vault server -config=/vault/config/vault.hcl`.
- `scripts/convert-dev-to-prod.sh`:
  Conversion script that exports secrets from dev Vault, starts Raft Vault, initializes/unseals, and imports secrets.
- `scripts/bootstrap-post-conversion.sh`:
  Post-conversion bootstrap script that enables audit logging, writes a least-privilege policy, and configures AppRole credentials for MCP service use.
- `backups/`:
  Export files created during conversion.

## Usage

From repository root:

```bash
bash vault-production/scripts/convert-dev-to-prod.sh --init-keys-out vault-production/backups/vault-init.json
```

Useful options:

```bash
# Use a different mount
bash vault-production/scripts/convert-dev-to-prod.sh --mount secret

# Skip export/import when testing only infrastructure transition
bash vault-production/scripts/convert-dev-to-prod.sh --skip-export --skip-import

# If Vault is already initialized, skip init/unseal steps
bash vault-production/scripts/convert-dev-to-prod.sh --skip-init

# Post-conversion hardening bootstrap (policy, AppRole, audit)
bash vault-production/scripts/bootstrap-post-conversion.sh --vault-token <root_or_admin_token>

# Emit credentials as JSON for CI pipelines
bash vault-production/scripts/bootstrap-post-conversion.sh \
  --vault-token <root_or_admin_token> \
  --output json

# Write credentials to a secure file
bash vault-production/scripts/bootstrap-post-conversion.sh \
  --vault-token <root_or_admin_token> \
  --output json \
  --output-file vault-production/backups/approle-credentials.json
```

## Important Follow-ups

1. Replace `tls_disable = 1` in `config/vault.hcl` with proper TLS cert/key settings.
2. Use the bootstrap script to create AppRole credentials, then stop using root token for applications.
3. Rotate bootstrap credentials and store generated ROLE_ID/SECRET_ID securely.
4. Back up Raft data and test restore procedures.

## Bootstrap Output Modes

- `--output env` (default): prints `ROLE_ID` and `SECRET_ID` as env-style lines.
- `--output json`: prints machine-readable JSON for CI/CD consumption.
- `--output-file <path>`: writes output to a file with restrictive permissions.
