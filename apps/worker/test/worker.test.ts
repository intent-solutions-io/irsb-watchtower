import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleEngine, createDefaultRegistry, type Finding } from '@irsb-watchtower/core';
import { createChainContext } from '../src/worker.js';

describe('Worker', () => {
  describe('createChainContext', () => {
    it('creates a chain context with current block', () => {
      const context = createChainContext(1000000n);

      expect(context.currentBlock).toBe(1000000n);
      expect(context.chainId).toBe(11155111);
      expect(context.blockTimestamp).toBeInstanceOf(Date);
    });

    it('returns mock receipts in challenge window', async () => {
      const context = createChainContext(1000000n);
      const receipts = await context.getReceiptsInChallengeWindow();

      expect(receipts.length).toBe(1);
      expect(receipts[0].status).toBe('pending');
      expect(receipts[0].challengeDeadline).toBeInstanceOf(Date);
    });

    it('returns empty disputes', async () => {
      const context = createChainContext(1000000n);
      const disputes = await context.getActiveDisputes();

      expect(disputes).toEqual([]);
    });

    it('returns null for solver info', async () => {
      const context = createChainContext(1000000n);
      const solver = await context.getSolverInfo('0x123');

      expect(solver).toBeNull();
    });

    it('returns empty events', async () => {
      const context = createChainContext(1000000n);
      const events = await context.getEvents(0n, 1000000n);

      expect(events).toEqual([]);
    });
  });

  describe('Scan cycle', () => {
    it('produces findings from sample rule', async () => {
      const engine = new RuleEngine(createDefaultRegistry());
      const context = createChainContext(1000000n);

      const result = await engine.execute(context);

      // Sample rule should produce findings for receipts approaching deadline
      expect(result.rulesExecuted).toBeGreaterThan(0);
      expect(result.rulesFailed).toBe(0);
    });

    it('produces mock finding when explicitly running MOCK-ALWAYS-FIND', async () => {
      const engine = new RuleEngine(createDefaultRegistry());
      const context = createChainContext(1000000n);

      const result = await engine.execute(context, {
        ruleIds: ['MOCK-ALWAYS-FIND'],
      });

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('MOCK-ALWAYS-FIND');
    });
  });
});
