import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
  getAgent,
  listAgents,
  getLatestRiskReport,
  listAlerts,
} from '@irsb-watchtower/watchtower-core';

export async function agentRoutes(fastify: FastifyInstance, opts: { db: Database.Database }): Promise<void> {
  const { db } = opts;

  /**
   * GET /v1/agents
   * List all agents with latest risk score and active alert count.
   */
  fastify.get('/v1/agents', async (_request, reply) => {
    const agents = listAgents(db);
    const enriched = agents.map((agent) => {
      const report = getLatestRiskReport(db, agent.agentId);
      const activeAlerts = listAlerts(db, { agentId: agent.agentId, activeOnly: true });
      return {
        agentId: agent.agentId,
        status: agent.status,
        labels: agent.labels,
        overallRisk: report?.overallRisk ?? null,
        confidence: report?.confidence ?? null,
        lastUpdated: report?.generatedAt ?? agent.createdAt,
        activeAlertsCount: activeAlerts.length,
      };
    });
    return reply.send({ agents: enriched });
  });

  /**
   * GET /v1/agents/:agentId/risk
   * Returns the latest risk report for an agent.
   */
  fastify.get<{ Params: { agentId: string } }>(
    '/v1/agents/:agentId/risk',
    async (request, reply) => {
      const { agentId } = request.params;
      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply.status(404).send({ error: 'agent not found' });
      }

      const report = getLatestRiskReport(db, agentId);
      if (!report) {
        return reply.status(404).send({ error: 'no risk report found' });
      }

      return reply.send(report);
    },
  );

  /**
   * GET /v1/agents/:agentId/alerts
   * Returns alerts for an agent.
   */
  fastify.get<{ Params: { agentId: string }; Querystring: { activeOnly?: string } }>(
    '/v1/agents/:agentId/alerts',
    async (request, reply) => {
      const { agentId } = request.params;
      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply.status(404).send({ error: 'agent not found' });
      }

      const activeOnly = request.query.activeOnly === 'true';
      const alerts = listAlerts(db, { agentId, activeOnly });

      return reply.send({ agentId, alerts });
    },
  );
}
