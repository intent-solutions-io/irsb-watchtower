# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IRSB-Watchtower** - Universal watchtower service for the IRSB (Intent Receipts & Solver Bonds) protocol.

This is an off-chain monitoring and enforcement tool that:
- Monitors IRSB contract events and state
- Detects violations using a deterministic rule engine
- Produces structured Findings
- Optionally auto-acts (open disputes, submit evidence)

**Status**: Epic 1 complete (Receipt Stale auto-challenge rule implemented)

## Architecture

Three-layer design:
1. **Core** (packages/core) - Portable rule engine, Finding schema, no cloud deps
2. **Runner** (apps/api, apps/worker) - API server + background scanner
3. **Signer** (packages/signers) - Pluggable: LocalPrivateKey → KMS → Lit PKP

### Data Flow

```
Worker scan cycle:
  IrsbClient → getBlockNumber() → createChainContext()
                                         ↓
  RuleEngine.execute(context) → ReceiptStaleRule.evaluate()
                                         ↓
                                    Finding[]
                                         ↓
  ActionExecutor.executeActions() → [DRY_RUN or real tx]
                                         ↓
                                  ActionLedger (idempotency)
```

## Repository Structure

```
IRSB-watchtower/
├── 000-docs/           # Flat documentation (12 files)
├── apps/
│   ├── api/            # Fastify HTTP API server
│   └── worker/         # Background scanner (apps/worker/src/worker.ts)
├── packages/
│   ├── config/         # Zod schemas, env loader
│   ├── core/           # Rule engine, Finding type, ActionExecutor
│   ├── chain/          # Chain provider abstraction (viem)
│   ├── irsb-adapter/   # IRSB contract interactions
│   └── signers/        # Signer implementations
├── infra/tofu/gcp/     # OpenTofu Cloud Run config
├── scripts/doctor.sh   # Environment check script
└── .github/            # CI workflow, PR template
```

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format with Prettier

# Development
pnpm dev:api          # API on :3000
pnpm dev:worker       # Background scanner

# Single package operations
pnpm --filter @irsb-watchtower/core test
pnpm --filter @irsb-watchtower/core test:watch
pnpm --filter @irsb-watchtower/api build
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
pnpm test                                         # All tests
pnpm --filter @irsb-watchtower/core test          # Single package
pnpm --filter @irsb-watchtower/core test:watch    # Watch mode
pnpm --filter @irsb-watchtower/core vitest run receiptStaleRule  # Single file
```

## Key Interfaces

**Rule** (packages/core/src/rules/rule.ts):
- `metadata: RuleMetadata` - id, name, severity, category, version
- `evaluate(context: ChainContext): Promise<Finding[]>` - must be idempotent and deterministic

**ChainContext** - Injected by runner, provides:
- `getReceiptsInChallengeWindow()` - Query receipts nearing deadline
- `getActiveDisputes()` - Query existing disputes
- `getSolverInfo(solverId)` - Query solver details
- `getEvents(fromBlock, toBlock)` - Raw event fetching

**Finding** (packages/core/src/finding.ts):
- Created via `createFinding({...})` helper
- Serialized via `serializeFinding()` for JSON transport
- Includes `recommendedAction: ActionType` (NONE, OPEN_DISPUTE, SUBMIT_EVIDENCE, etc.)

**ActionExecutor** (packages/core/src/actions/actionExecutor.ts):
- Processes findings with recommended actions
- Respects `DRY_RUN` mode and rate limits (`maxActionsPerBatch`)
- Uses `ActionLedger` for idempotency (won't re-act on same receipt)

## Writing New Rules

1. Create rule class implementing `Rule` interface in `packages/core/src/rules/`
2. Define `metadata: RuleMetadata` (id, name, severity, category, version)
3. Implement `evaluate(context: ChainContext): Promise<Finding[]>`
4. Export from `packages/core/src/rules/index.ts`
5. Register in worker's `RuleRegistry` (apps/worker/src/worker.ts)
6. Add tests in `packages/core/test/`

Reference: `ReceiptStaleRule` in `packages/core/src/rules/receiptStaleRule.ts`

## Non-Negotiables

- Actions disabled by default (`ENABLE_ACTIONS=false`)
- Start with `DRY_RUN=true` for any new deployment
- Never log private keys
- Rules must be deterministic and idempotent
- All config validated by Zod
- Docs stay in flat `000-docs/` (no subdirectories)
