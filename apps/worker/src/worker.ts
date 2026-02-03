import {
  RuleEngine,
  RuleRegistry,
  createReceiptStaleRule,
  serializeFinding,
  type ChainContext,
  type Finding,
  ActionLedger,
  BlockCursor,
  ActionExecutor,
  ActionType,
} from '@irsb-watchtower/core';
import { parseAllowlist } from '@irsb-watchtower/config';
import { IrsbClient } from '@irsb-watchtower/irsb-adapter';
import { createLogger } from './lib/logger.js';
import { getConfig } from './lib/config.js';

/**
 * Create a chain context for rule evaluation using the IRSB client
 */
function createChainContext(
  _client: IrsbClient, // Prefixed to indicate intentionally unused for now
  blockNumber: bigint,
  blockTimestamp: Date,
  chainId: number
): ChainContext {
  return {
    currentBlock: blockNumber,
    blockTimestamp,
    chainId,

    async getReceiptsInChallengeWindow() {
      // In production, this would query the IRSB client for receipts
      // For now, return mock data that demonstrates the rule
      // TODO: Replace with actual client.getReceiptPostedEvents() + enrichment
      return [
        {
          id: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          intentHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          solverId: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
          createdAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending' as const,
          // Challenge deadline was 30 minutes ago (stale!)
          challengeDeadline: new Date(Date.now() - 30 * 60 * 1000),
          blockNumber: blockNumber - 100n,
          txHash: `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`,
        },
      ];
    },

    async getActiveDisputes() {
      // TODO: Replace with actual client.getDisputeOpenedEvents()
      return [];
    },

    async getSolverInfo(_solverId: string) {
      // TODO: Replace with actual client.getSolver()
      return null;
    },

    async getEvents(_fromBlock: bigint, _toBlock: bigint) {
      // TODO: Replace with actual event fetching
      return [];
    },
  };
}

/**
 * Post findings to API (if configured)
 */
async function postFindingsToApi(
  findings: Finding[],
  apiUrl: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
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
  client: IrsbClient,
  cursor: BlockCursor,
  executor: ActionExecutor,
  logger: ReturnType<typeof createLogger>,
  config: ReturnType<typeof getConfig>
): Promise<Finding[]> {
  // Get current block and its timestamp from the chain
  const currentBlock = await client.getBlockNumber();
  const blockTimestamp = new Date(Number(await client.getBlockTimestamp(currentBlock)) * 1000);

  // Get start block for scan
  const startBlock = cursor.getStartBlock(
    currentBlock,
    config.worker.lookbackBlocks,
    config.rules.blockConfirmations
  );

  logger.info(
    {
      currentBlock: currentBlock.toString(),
      startBlock: startBlock.toString(),
      endBlock: currentBlock.toString(),
    },
    'Starting scan cycle'
  );

  // Create chain context
  const context = createChainContext(client, currentBlock, blockTimestamp, config.chain.chainId);

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
          receiptId: finding.receiptId,
          recommendedAction: finding.recommendedAction,
        },
        'Finding detected'
      );
    }

    // Execute actions for findings
    const actionResults = await executor.executeActions(result.findings);

    for (const actionResult of actionResults) {
      if (actionResult.success) {
        if (actionResult.dryRun) {
          logger.info(
            { receiptId: actionResult.finding.receiptId, action: actionResult.finding.recommendedAction },
            '[DRY RUN] Would execute action'
          );
        } else {
          logger.info(
            { receiptId: actionResult.finding.receiptId, txHash: actionResult.txHash },
            'Action executed successfully'
          );
        }
      } else {
        logger.error(
          { receiptId: actionResult.finding.receiptId, error: actionResult.error },
          'Action execution failed'
        );
      }
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

  // Update cursor
  cursor.update(currentBlock);

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
      dryRun: config.rules.dryRun,
      maxActionsPerScan: config.rules.maxActionsPerScan,
    },
    'IRSB Watchtower Worker starting'
  );

  // Initialize state management
  const ledger = new ActionLedger(config.rules.stateDir);
  const cursor = new BlockCursor(config.rules.stateDir, config.chain.chainId);

  logger.info(
    {
      stateDir: config.rules.stateDir,
      ledgerSize: ledger.size,
      lastProcessedBlock: cursor.getLastProcessedBlock()?.toString() ?? 'none',
    },
    'State management initialized'
  );

  // Create IRSB client
  const client = new IrsbClient({
    rpcUrl: config.chain.rpcUrl,
    chainId: config.chain.chainId,
    contracts: config.contracts,
  });

  // Create action executor
  const executor = new ActionExecutor({
    dryRun: config.rules.dryRun,
    maxActionsPerBatch: config.rules.maxActionsPerScan,
    ledger,
  });

  // Set up logger for executor
  executor.setLogger((message: string, level: 'info' | 'warn' | 'error') => {
    logger[level]({ component: 'ActionExecutor' }, message);
  });

  // Register action handlers
  // In production, these would call the IRSB client to execute transactions
  executor.registerHandler('OPEN_DISPUTE' as ActionType, async (finding: Finding) => {
    // TODO: Implement actual dispute opening via client
    logger.info({ receiptId: finding.receiptId }, 'Opening dispute');
    // const txHash = await client.openDispute({ ... });
    return { txHash: '0xmock_tx_hash' };
  });

  // Create rule registry with receipt stale rule
  const registry = new RuleRegistry();

  // Add the receipt stale rule with config
  const receiptStaleRule = createReceiptStaleRule({
    challengeWindowSeconds: config.rules.challengeWindowSeconds,
    minReceiptAgeSeconds: config.rules.minReceiptAgeSeconds,
    allowlistSolverIds: parseAllowlist(config.rules.allowlistSolverIds),
    allowlistReceiptIds: parseAllowlist(config.rules.allowlistReceiptIds),
    blockConfirmations: config.rules.blockConfirmations,
  });
  registry.register(receiptStaleRule);

  // Create rule engine
  const engine = new RuleEngine(registry);

  // Log registered rules
  const rules = engine.getRegistry().getAll();
  logger.info(
    { ruleCount: rules.length, rules: rules.map((r) => r.metadata.id) },
    'Rules registered'
  );

  // Run initial scan
  await runScanCycle(engine, client, cursor, executor, logger, config);

  // Start interval loop
  const intervalId = setInterval(async () => {
    try {
      await runScanCycle(engine, client, cursor, executor, logger, config);
    } catch (error) {
      logger.error({ error }, 'Scan cycle failed');
    }
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
