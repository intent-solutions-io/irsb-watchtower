import type { FastifyInstance } from 'fastify';
import {
  verifyLogFile,
  readLogFile,
  logFilePath,
} from '@irsb-watchtower/watchtower-core';

export async function transparencyRoutes(
  fastify: FastifyInstance,
  opts: { logDir: string; publicKey?: string },
): Promise<void> {
  const { logDir, publicKey } = opts;

  /**
   * GET /v1/transparency/status
   * Transparency health: scans last 7 days of log files.
   */
  fastify.get('/v1/transparency/status', async (_request, reply) => {
    if (!publicKey) {
      return reply.status(503).send({ error: 'no public key configured' });
    }

    const today = new Date();
    const recentVerifications = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00Z');
      const filePath = logFilePath(logDir, date);
      const result = verifyLogFile(filePath, publicKey);

      recentVerifications.push({
        date: dateStr,
        totalLeaves: result.totalLeaves,
        validLeaves: result.validLeaves,
        invalidLeaves: result.invalidLeaves,
        corrupt: result.invalidLeaves > 0,
      });
    }

    const latest = recentVerifications[0]!;
    return reply.send({
      latestDate: latest.date,
      latestLeafCount: latest.totalLeaves,
      recentVerifications,
      publicKey,
    });
  });

  /**
   * GET /v1/transparency/leaves?date=YYYY-MM-DD
   * Read leaves from the log for a given date.
   */
  fastify.get<{ Querystring: { date?: string } }>(
    '/v1/transparency/leaves',
    async (request, reply) => {
      const dateStr = request.query.date ?? new Date().toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00Z');
      if (isNaN(date.getTime())) {
        return reply.status(400).send({ error: 'invalid date format' });
      }

      const filePath = logFilePath(logDir, date);
      const leaves = readLogFile(filePath);
      return reply.send({ date: dateStr, count: leaves.length, leaves });
    },
  );

  /**
   * GET /v1/transparency/verify?date=YYYY-MM-DD
   * Verify integrity of the transparency log for a given date.
   */
  fastify.get<{ Querystring: { date?: string } }>(
    '/v1/transparency/verify',
    async (request, reply) => {
      if (!publicKey) {
        return reply.status(503).send({ error: 'no public key configured' });
      }

      const dateStr = request.query.date ?? new Date().toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00Z');
      if (isNaN(date.getTime())) {
        return reply.status(400).send({ error: 'invalid date format' });
      }

      const filePath = logFilePath(logDir, date);
      const result = verifyLogFile(filePath, publicKey);
      return reply.send(result);
    },
  );
}
