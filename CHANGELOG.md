# Changelog

All notable changes to IRSB-Watchtower will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-03

### Added
- **Multi-Chain Support** - Run concurrent watchers per chain with chain-specific state isolation (#6)
- **CLI Utilities** - New `@irsb-watchtower/cli` package with `health`, `check-config`, and `simulate` commands
- **Chain-Specific State** - ActionLedger and BlockCursor now support chain ID for proper multi-chain isolation
- **CHAINS_CONFIG** - New environment variable for JSON array of chain configurations

### Changed
- Worker refactored to use `ScanContext` pattern for cleaner parameter passing
- Configuration schema extended with `chainEntrySchema` and `multiChainConfigSchema`

## [0.2.0] - 2026-02-03

### Added
- **Evidence Store** - JSONL persistence with Zod schema validation, file rotation, and query API
- **Resilience Patterns** - Retry with exponential backoff and circuit breaker for chain operations
- **Webhook Sink** - Configurable webhook notifications with HMAC-SHA256 signing
- **Prometheus Metrics** - `/metrics` endpoint with findings, actions, RPC latency, and rule duration histograms
- **Security Scan** - CI now includes `pnpm audit` for dependency vulnerability detection
- **Receipt Stale Rule** - First production rule detecting stale receipts past challenge window (Epic 1)
- **Action Executor** - Executes on-chain actions with dry-run mode and action ledger
- **State Management** - Checkpoint persistence for resumable scanning

### Changed
- CI workflow now runs build before typecheck for proper monorepo dependency resolution
- ESLint config updated to disable import resolver rules (ESM compatibility)

## [0.1.0] - 2026-01-30

### Added
- Initial scaffold with monorepo structure (pnpm workspaces)
- Core rule engine with Finding schema
- Chain provider abstraction (viem-based)
- IRSB contract adapter for Sepolia testnet
- Pluggable signer architecture (local, GCP-KMS, Lit PKP)
- Fastify API server with health, scan, and action endpoints
- Background worker for continuous scanning
- Comprehensive documentation in `000-docs/`
