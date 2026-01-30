import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  RuleEngine,
  createDefaultRegistry,
  serializeFinding,
  type ChainContext,
} from '@irsb-watchtower/core';

/**
 * Scan request body
 */
interface ScanRequestBody {
  /** Specific rule IDs to run (optional, runs all enabled if not specified) */
  ruleIds?: string[];

  /** Number of blocks to look back (optional) */
  lookbackBlocks?: number;
}

/**
 * Scan response
 */
interface ScanResponse {
  success: boolean;
  findings: unknown[];
  metadata: {
    rulesExecuted: number;
    rulesFailed: number;
    totalDurationMs: number;
    blockNumber: string;
    timestamp: string;
  };
  errors?: Array<{ ruleId: string; error: string }>;
}

/**
 * Create a mock chain context for scanning
 *
 * TODO: Replace with real chain context that queries actual contracts
 */
function createMockChainContext(): ChainContext {
  return {
    currentBlock: BigInt(Math.floor(Date.now() / 1000)), // Mock block number
    blockTimestamp: new Date(),
    chainId: 11155111, // Sepolia

    async getReceiptsInChallengeWindow() {
      // TODO: Query IntentReceiptHub for receipts in challenge window
      return [];
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
 * Register scan routes
 */
export async function scanRoutes(fastify: FastifyInstance): Promise<void> {
  // Create rule engine with default rules
  const engine = new RuleEngine(createDefaultRegistry());

  /**
   * POST /scan
   *
   * Trigger a scan and return findings
   */
  fastify.post<{ Body: ScanRequestBody }>(
    '/scan',
    async (request: FastifyRequest<{ Body: ScanRequestBody }>, reply: FastifyReply) => {
      const { ruleIds } = request.body || {};

      fastify.log.info({ ruleIds }, 'Starting scan');

      try {
        // Create chain context
        const context = createMockChainContext();

        // Execute rules
        const result = await engine.execute(context, { ruleIds });

        // Collect any errors
        const errors = result.ruleResults
          .filter((r) => r.error)
          .map((r) => ({
            ruleId: r.ruleId,
            error: r.error!.message,
          }));

        const response: ScanResponse = {
          success: result.rulesFailed === 0,
          findings: result.findings.map(serializeFinding),
          metadata: {
            rulesExecuted: result.rulesExecuted,
            rulesFailed: result.rulesFailed,
            totalDurationMs: result.totalDurationMs,
            blockNumber: context.currentBlock.toString(),
            timestamp: new Date().toISOString(),
          },
          ...(errors.length > 0 && { errors }),
        };

        fastify.log.info(
          {
            findingsCount: result.findings.length,
            rulesExecuted: result.rulesExecuted,
            durationMs: result.totalDurationMs,
          },
          'Scan completed'
        );

        return reply.send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Scan failed');
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /scan/rules
   *
   * List available rules
   */
  fastify.get('/scan/rules', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = engine.getRegistry().getAll().map((rule) => ({
      id: rule.metadata.id,
      name: rule.metadata.name,
      description: rule.metadata.description,
      severity: rule.metadata.defaultSeverity,
      category: rule.metadata.category,
      enabledByDefault: rule.metadata.enabledByDefault,
      version: rule.metadata.version,
    }));

    return reply.send({ rules });
  });
}
