# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IRSB-Watchtower** - Universal watchtower service for the IRSB (Intent Receipts & Solver Bonds) protocol.

This is an off-chain monitoring and enforcement tool that:
- Monitors IRSB contract events and state
- Detects violations using a deterministic rule engine
- Produces structured Findings
- Optionally auto-acts (open disputes, submit evidence)

**Status**: Scaffold complete, ready for Epic 1 (real rule implementation)

## Architecture

Three-layer design:
1. **Core** (packages/core) - Portable rule engine, Finding schema, no cloud deps
2. **Runner** (apps/api, apps/worker) - API server + background scanner
3. **Signer** (packages/signers) - Pluggable: LocalPrivateKey → KMS → Lit PKP

pnpm workspace monorepo. All packages are ESM-only (`"type": "module"`) - use `.js` extension in imports.

## Repository Structure

```
IRSB-watchtower/
├── 000-docs/           # Flat documentation (11 files)
├── apps/
│   ├── api/            # Fastify HTTP API server
│   └── worker/         # Background scanner
├── packages/
│   ├── config/         # Zod schemas, env loader
│   ├── core/           # Rule engine, Finding type
│   ├── chain/          # Chain provider abstraction (viem)
│   ├── irsb-adapter/   # IRSB contract interactions
│   └── signers/        # Signer implementations
├── infra/tofu/gcp/     # OpenTofu Cloud Run config
├── scripts/doctor.sh   # Environment check script
└── .github/            # CI workflow, PR template
```

## Build Commands

```bash
pnpm install       # Install dependencies
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm typecheck     # Type checking
pnpm lint          # Linting
pnpm lint:fix      # Lint and auto-fix
pnpm format        # Format with Prettier
pnpm format:check  # Check formatting
pnpm clean         # Remove all dist/ and node_modules

# Development
pnpm dev:api       # API on :3000
pnpm dev:worker    # Background scanner
```

## Key IRSB Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/scan` | Trigger scan, return findings |
| GET | `/scan/rules` | List available rules |
| POST | `/actions/open-dispute` | Open dispute (if enabled) |
| POST | `/actions/submit-evidence` | Submit evidence (if enabled) |
| GET | `/actions/status` | Check if actions enabled |

## Configuration

All via environment variables (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `RPC_URL` | Yes | Ethereum RPC endpoint |
| `CHAIN_ID` | Yes | Target chain (11155111 for Sepolia) |
| `ENABLE_ACTIONS` | No | Enable on-chain actions (default: false) |
| `SIGNER_TYPE` | If actions | local, gcp-kms, or lit-pkp |
| `PRIVATE_KEY` | If local | Private key for local signer |

## Testing

```bash
pnpm test                                    # All tests
pnpm --filter @irsb-watchtower/core test     # Specific package
pnpm --filter @irsb-watchtower/api test:watch  # Watch mode

# Single test file (from package directory)
cd packages/core && pnpm vitest run src/engine.test.ts
```

## Documentation

All docs in flat `000-docs/` directory:
- `001-ARCH-*` - Architecture documents
- `003-ARCH-finding-schema.md` - Finding JSON schema
- `004-ARCH-rule-engine.md` - Rule interface, implementation
- `005-SEC-*` - Security documents
- `007-RUN-local.md` - Local quickstart
- `009-API-http.md` - Full API reference

## Writing New Rules

1. Create rule class implementing `Rule` interface
2. Define metadata (id, name, severity, category)
3. Implement `evaluate(context: ChainContext)` → `Finding[]`
4. Register in `packages/core/src/rules/index.ts`
5. Add tests in `packages/core/test/`

## Non-Negotiables

- Actions disabled by default (`ENABLE_ACTIONS=false`)
- Never log private keys
- Rules must be deterministic and idempotent
- All config validated by Zod
- Docs stay in flat `000-docs/` (no subdirectories)

## Next Steps (Epic 1)

Ready to implement first real rule:
1. Connect to real IRSB contracts on Sepolia
2. Implement "Receipt challenge-window timeout" rule
3. Wire `open-dispute` action to real transactions
