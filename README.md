# IRSB Watchtower

Universal watchtower service for the IRSB (Intent Receipts & Solver Bonds) protocol.

Monitors on-chain activity, detects violations, and optionally auto-acts (disputes, evidence submission).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        IRSB Watchtower                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │     Core     │    │    Runner    │    │    Signer    │      │
│  │  (portable)  │    │ (env-aware)  │    │  (pluggable) │      │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤      │
│  │ Rule Engine  │    │   API App    │    │ LocalPrivKey │      │
│  │ Finding Type │    │ Worker App   │    │ GCP KMS ○    │      │
│  │ No cloud dep │    │ Config load  │    │ Lit PKP ○    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ○ = stub (not yet implemented)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Prerequisites
node --version  # >= 20.0.0
pnpm --version  # >= 8.0.0

# Clone and install
git clone https://github.com/yourusername/IRSB-watchtower.git
cd IRSB-watchtower
pnpm install

# Configure
cp .env.example .env
# Edit .env with your RPC URL and settings

# Run checks
./scripts/doctor.sh

# Build all packages
pnpm build

# Start development
pnpm dev:api      # Terminal 1 - API server on :3000
pnpm dev:worker   # Terminal 2 - Background scanner
```

## Packages

| Package | Description |
|---------|-------------|
| `@irsb-watchtower/config` | Zod schemas, environment loader, type exports |
| `@irsb-watchtower/core` | Rule engine, Finding type, no external deps |
| `@irsb-watchtower/chain` | Chain provider abstraction (viem) |
| `@irsb-watchtower/irsb-adapter` | IRSB contract interactions |
| `@irsb-watchtower/signers` | Pluggable signer interface |

## Apps

| App | Description |
|-----|-------------|
| `@irsb-watchtower/api` | Fastify HTTP server with scan/action endpoints |
| `@irsb-watchtower/worker` | Background scanner that runs rules on interval |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/scan` | Trigger scan, return findings |
| POST | `/actions/open-dispute` | Open dispute (if ENABLE_ACTIONS=true) |
| POST | `/actions/submit-evidence` | Submit evidence (if ENABLE_ACTIONS=true) |

## Commands

```bash
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript checks
pnpm format       # Format with Prettier

pnpm dev:api      # Start API in dev mode
pnpm dev:worker   # Start worker in dev mode
```

## Documentation

See [000-docs/](./000-docs/) for detailed documentation:

- Architecture overview
- Runtime model
- Finding schema
- Rule engine design
- Security & threat model
- Deployment guides

## IRSB Protocol

This watchtower monitors the IRSB protocol contracts:

| Contract | Sepolia Address |
|----------|-----------------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## License

MIT
