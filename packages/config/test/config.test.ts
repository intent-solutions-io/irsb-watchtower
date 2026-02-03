import { describe, it, expect } from 'vitest';
import { loadConfig, loadConfigWithDefaults, watchtowerConfigSchema } from '../src/index.js';

describe('config schema', () => {
  it('validates a complete valid configuration', () => {
    const config = {
      chain: {
        rpcUrl: 'https://rpc.sepolia.org',
        chainId: 11155111,
      },
      contracts: {
        solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
        intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
        disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
      },
      api: {
        port: 3000,
        host: '0.0.0.0',
        enableActions: false,
      },
      worker: {
        scanIntervalMs: 60000,
        lookbackBlocks: 1000,
        postToApi: false,
      },
      rules: {
        challengeWindowSeconds: 3600,
        minReceiptAgeSeconds: 3600,
        maxActionsPerScan: 3,
        dryRun: true,
        allowlistSolverIds: '',
        allowlistReceiptIds: '',
        stateDir: '.state',
        blockConfirmations: 6,
      },
      logging: {
        level: 'info',
        format: 'pretty',
      },
      webhook: {
        enabled: false,
      },
      resilience: {},
      evidence: {},
      nodeEnv: 'development',
    };

    const result = watchtowerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects invalid Ethereum addresses', () => {
    const config = {
      chain: {
        rpcUrl: 'https://rpc.sepolia.org',
        chainId: 11155111,
      },
      contracts: {
        solverRegistry: 'not-an-address',
        intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
        disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
      },
      api: {},
      worker: {},
      logging: {},
    };

    const result = watchtowerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const config = {
      chain: {
        rpcUrl: 'https://rpc.sepolia.org',
        chainId: 11155111,
      },
      contracts: {
        solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
        intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
        disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
      },
      api: {},
      worker: {},
      rules: {},
      logging: {},
      webhook: {},
      resilience: {},
      evidence: {},
    };

    const result = watchtowerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api.port).toBe(3000);
      expect(result.data.api.enableActions).toBe(false);
      expect(result.data.worker.scanIntervalMs).toBe(60000);
      expect(result.data.logging.level).toBe('info');
      expect(result.data.rules.dryRun).toBe(true);
      expect(result.data.rules.challengeWindowSeconds).toBe(3600);
      expect(result.data.webhook.enabled).toBe(false);
      expect(result.data.resilience.maxRetries).toBe(3);
      expect(result.data.resilience.circuitBreakerFailureThreshold).toBe(5);
      expect(result.data.evidence.enabled).toBe(false);
      expect(result.data.evidence.dataDir).toBe('./data');
      expect(result.data.evidence.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    }
  });
});

describe('loadConfig', () => {
  it('loads configuration from environment variables', () => {
    const env = {
      RPC_URL: 'https://rpc.sepolia.org',
      CHAIN_ID: '11155111',
      SOLVER_REGISTRY_ADDRESS: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
      INTENT_RECEIPT_HUB_ADDRESS: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
      DISPUTE_MODULE_ADDRESS: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
    };

    const config = loadConfig(env);
    expect(config.chain.rpcUrl).toBe('https://rpc.sepolia.org');
    expect(config.chain.chainId).toBe(11155111);
  });

  it('throws on missing required fields', () => {
    const env = {
      RPC_URL: 'https://rpc.sepolia.org',
      // Missing CHAIN_ID and contract addresses
    };

    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });

  it('loads local signer config when SIGNER_TYPE=local', () => {
    const env = {
      RPC_URL: 'https://rpc.sepolia.org',
      CHAIN_ID: '11155111',
      SOLVER_REGISTRY_ADDRESS: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
      INTENT_RECEIPT_HUB_ADDRESS: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
      DISPUTE_MODULE_ADDRESS: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
      SIGNER_TYPE: 'local',
      PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    };

    const config = loadConfig(env);
    expect(config.signer?.type).toBe('local');
  });
});

describe('loadConfigWithDefaults', () => {
  it('uses Sepolia defaults when env vars are missing', () => {
    const config = loadConfigWithDefaults({});
    expect(config.chain.chainId).toBe(11155111);
    expect(config.contracts.solverRegistry).toBe('0xB6ab964832808E49635fF82D1996D6a888ecB745');
  });
});
