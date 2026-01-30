import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../lib/config.js';

/**
 * Open dispute request body
 */
interface OpenDisputeRequest {
  /** Receipt ID to dispute */
  receiptId: string;

  /** Reason for dispute */
  reason: string;

  /** Evidence hash (IPFS CID, etc) */
  evidenceHash: string;

  /** Bond amount in wei */
  bondAmount: string;
}

/**
 * Submit evidence request body
 */
interface SubmitEvidenceRequest {
  /** Dispute ID */
  disputeId: string;

  /** Evidence hash */
  evidenceHash: string;

  /** Optional description */
  description?: string;
}

/**
 * Action response
 */
interface ActionResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  message?: string;
}

/**
 * Register action routes
 *
 * These routes are disabled by default (ENABLE_ACTIONS=false)
 * They allow the watchtower to take on-chain actions like opening disputes
 */
export async function actionRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  /**
   * Middleware to check if actions are enabled
   */
  const checkActionsEnabled = async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!config.api.enableActions) {
      return reply.status(403).send({
        success: false,
        error: 'Actions are disabled',
        message: 'Set ENABLE_ACTIONS=true to enable on-chain actions',
      });
    }
  };

  /**
   * POST /actions/open-dispute
   *
   * Open a dispute against a receipt
   */
  fastify.post<{ Body: OpenDisputeRequest }>(
    '/actions/open-dispute',
    { preHandler: [checkActionsEnabled] },
    async (request: FastifyRequest<{ Body: OpenDisputeRequest }>, reply: FastifyReply) => {
      const { receiptId, reason, evidenceHash, bondAmount } = request.body;

      fastify.log.info({ receiptId, reason }, 'Opening dispute');

      // TODO: Implement actual dispute opening
      // 1. Validate receipt exists and is disputable
      // 2. Get signer from config
      // 3. Call IrsbClient.openDispute()
      // 4. Wait for transaction confirmation
      // 5. Return transaction hash

      // For now, return a mock response
      const response: ActionResponse = {
        success: false,
        error: 'Not implemented',
        message: `Would open dispute for receipt ${receiptId} with reason "${reason}", evidence ${evidenceHash}, bond ${bondAmount} wei`,
      };

      return reply.status(501).send(response);
    }
  );

  /**
   * POST /actions/submit-evidence
   *
   * Submit additional evidence for an existing dispute
   */
  fastify.post<{ Body: SubmitEvidenceRequest }>(
    '/actions/submit-evidence',
    { preHandler: [checkActionsEnabled] },
    async (request: FastifyRequest<{ Body: SubmitEvidenceRequest }>, reply: FastifyReply) => {
      const { disputeId, evidenceHash, description } = request.body;

      fastify.log.info({ disputeId, evidenceHash }, 'Submitting evidence');

      // TODO: Implement actual evidence submission
      // 1. Validate dispute exists and accepts evidence
      // 2. Get signer from config
      // 3. Call IrsbClient.submitEvidence()
      // 4. Wait for transaction confirmation
      // 5. Return transaction hash

      const response: ActionResponse = {
        success: false,
        error: 'Not implemented',
        message: `Would submit evidence ${evidenceHash} for dispute ${disputeId}${description ? ` with description: ${description}` : ''}`,
      };

      return reply.status(501).send(response);
    }
  );

  /**
   * GET /actions/status
   *
   * Check if actions are enabled and signer is healthy
   */
  fastify.get('/actions/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const status = {
      enabled: config.api.enableActions,
      signerConfigured: !!config.signer,
      signerType: config.signer?.type ?? null,
      signerHealthy: false, // TODO: Check actual signer health
    };

    return reply.send(status);
  });
}
