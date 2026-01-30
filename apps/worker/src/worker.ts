import {
  RuleEngine,
  createDefaultRegistry,
  serializeFinding,
  type ChainContext,
  type Finding,
} from '@irsb-watchtower/core';
import { createLogger } from './lib/logger.js';
import { getConfig } from './lib/config.js';

/**
 * Create a chain context for rule evaluation
 *
 * TODO: Replace with real chain context that queries actual contracts
 */
function createChainContext(blockNumber: bigint): ChainContext {
  return {
    currentBlock: blockNumber,
    blockTimestamp: new Date(),
    chainId: 11155111, // Sepolia

    async getReceiptsInChallengeWindow() {
      // TODO: Query IntentReceiptHub for receipts in challenge window
      // For mock purposes, return a sample receipt approaching deadline
      return [
        {
          id: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          intentHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          solverId: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          createdAt: new Date(Date.now() - 50 * 60 * 1000), // 50 minutes ago
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          status: 'pending' as const,
          challengeDeadline: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
          blockNumber: blockNumber - 100n,
          txHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
        },
      ];
    },

    async getActiveDisputes() {
      // TODO: Query IntentReceiptHub for active disputes
      return [];
    },

    async getSolverInfo(_solverId: string) {
      // TODO: Query SolverRegistry for solver info
      return null;
    },

    async getEvents(_fromBlock: bigint, _toBlock: bigint) {
      // TODO: Query chain for events
      return [];
    },
  };
}

/**
 * Post findings to API (if configured)
 */
async function postFindingsToApi(findings: Finding[], apiUrl: string, logger: ReturnType<typeof createLogger>): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings: findings.map(serializeFinding) }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to post findings to API');
    } else {
      logger.debug({ count: findings.length }, 'Posted findings to API');
    }
  } catch (error) {
    logger.warn({ error }, 'Error posting findings to API');
  }
}

/**
 * Run a single scan cycle
 */
async function runScanCycle(
  engine: RuleEngine,
  blockNumber: bigint,
  logger: ReturnType<typeof createLogger>,
  config: ReturnType<typeof getConfig>
): Promise<Finding[]> {
  logger.info({ blockNumber: blockNumber.toString() }, 'Starting scan cycle');

  // Create chain context
  const context = createChainContext(blockNumber);

  // Execute rules
  const result = await engine.execute(context);

  // Log results
  if (result.findings.length > 0) {
    logger.info(
      {
        findingsCount: result.findings.length,
        rulesExecuted: result.rulesExecuted,
        durationMs: result.totalDurationMs,
      },
      'Scan cycle completed with findings'
    );

    // Log each finding
    for (const finding of result.findings) {
      logger.warn(
        {
          ruleId: finding.ruleId,
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
        },
        'Finding detected'
      );
    }
  } else {
    logger.debug(
      {
        rulesExecuted: result.rulesExecuted,
        durationMs: result.totalDurationMs,
      },
      'Scan cycle completed - no findings'
    );
  }

  // Log any rule errors
  for (const ruleResult of result.ruleResults) {
    if (ruleResult.error) {
      logger.error(
        {
          ruleId: ruleResult.ruleId,
          error: ruleResult.error.message,
        },
        'Rule execution error'
      );
    }
  }

  // Post to API if configured
  if (config.worker.postToApi && config.worker.apiUrl) {
    await postFindingsToApi(result.findings, config.worker.apiUrl, logger);
  }

  return result.findings;
}

/**
 * Main worker loop
 */
async function main() {
  const config = getConfig();
  const logger = createLogger(config.logging.level, config.logging.format);

  logger.info(
    {
      scanIntervalMs: config.worker.scanIntervalMs,
      chainId: config.chain.chainId,
      postToApi: config.worker.postToApi,
    },
    'IRSB Watchtower Worker starting'
  );

  // Create rule engine
  const engine = new RuleEngine(createDefaultRegistry());

  // Log registered rules
  const rules = engine.getRegistry().getAll();
  logger.info(
    { ruleCount: rules.length, rules: rules.map((r) => r.metadata.id) },
    'Rules registered'
  );

  // Track mock block number (would be fetched from chain in production)
  let mockBlockNumber = 1000000n;

  // Run initial scan
  await runScanCycle(engine, mockBlockNumber, logger, config);

  // Start interval loop
  const intervalId = setInterval(async () => {
    mockBlockNumber += 10n; // Simulate block progression
    await runScanCycle(engine, mockBlockNumber, logger, config);
  }, config.worker.scanIntervalMs);

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down worker');
    clearInterval(intervalId);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Worker running. Press Ctrl+C to stop.');
}

// Run if this is the main module
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { runScanCycle, createChainContext };
