import {
  type WatchtowerConfig,
  watchtowerConfigSchema,
  type SignerConfig,
  type SignerType,
} from './schema.js';

/**
 * Build signer config from environment variables based on type
 */
function buildSignerConfig(env: NodeJS.ProcessEnv): SignerConfig | undefined {
  const signerType = env.SIGNER_TYPE as SignerType | undefined;

  if (!signerType) {
    return undefined;
  }

  switch (signerType) {
    case 'local':
      if (!env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is required when SIGNER_TYPE=local');
      }
      return {
        type: 'local',
        privateKey: env.PRIVATE_KEY,
      };

    case 'gcp-kms':
      if (!env.GCP_PROJECT_ID || !env.GCP_KMS_LOCATION || !env.GCP_KMS_KEYRING || !env.GCP_KMS_KEY) {
        throw new Error(
          'GCP_PROJECT_ID, GCP_KMS_LOCATION, GCP_KMS_KEYRING, and GCP_KMS_KEY are required when SIGNER_TYPE=gcp-kms'
        );
      }
      return {
        type: 'gcp-kms',
        projectId: env.GCP_PROJECT_ID,
        location: env.GCP_KMS_LOCATION,
        keyring: env.GCP_KMS_KEYRING,
        key: env.GCP_KMS_KEY,
      };

    case 'lit-pkp':
      if (!env.LIT_PKP_PUBLIC_KEY || !env.LIT_AUTH_SIG) {
        throw new Error('LIT_PKP_PUBLIC_KEY and LIT_AUTH_SIG are required when SIGNER_TYPE=lit-pkp');
      }
      return {
        type: 'lit-pkp',
        pkpPublicKey: env.LIT_PKP_PUBLIC_KEY,
        authSig: env.LIT_AUTH_SIG,
      };

    default:
      throw new Error(`Unknown SIGNER_TYPE: ${signerType}`);
  }
}

/**
 * Load and validate configuration from environment variables
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Validated watchtower configuration
 * @throws Error if validation fails
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WatchtowerConfig {
  const rawConfig = {
    chain: {
      rpcUrl: env.RPC_URL,
      chainId: env.CHAIN_ID,
    },
    contracts: {
      solverRegistry: env.SOLVER_REGISTRY_ADDRESS,
      intentReceiptHub: env.INTENT_RECEIPT_HUB_ADDRESS,
      disputeModule: env.DISPUTE_MODULE_ADDRESS,
    },
    signer: buildSignerConfig(env),
    api: {
      port: env.API_PORT,
      host: env.API_HOST,
      enableActions: env.ENABLE_ACTIONS,
    },
    worker: {
      scanIntervalMs: env.SCAN_INTERVAL_MS,
      lookbackBlocks: env.LOOKBACK_BLOCKS,
      postToApi: env.WORKER_POST_TO_API,
      apiUrl: env.API_URL,
    },
    rules: {
      challengeWindowSeconds: env.CHALLENGE_WINDOW_SECONDS,
      minReceiptAgeSeconds: env.MIN_RECEIPT_AGE_SECONDS,
      maxActionsPerScan: env.MAX_ACTIONS_PER_SCAN,
      dryRun: env.DRY_RUN,
      allowlistSolverIds: env.ACTION_ALLOWLIST_SOLVER_IDS,
      allowlistReceiptIds: env.ACTION_ALLOWLIST_RECEIPT_IDS,
      stateDir: env.STATE_DIR,
      blockConfirmations: env.BLOCK_CONFIRMATIONS,
    },
    logging: {
      level: env.LOG_LEVEL,
      format: env.LOG_FORMAT,
    },
    nodeEnv: env.NODE_ENV,
  };

  const result = watchtowerConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Load configuration with graceful defaults for development
 * Falls back to Sepolia testnet addresses if not provided
 */
export function loadConfigWithDefaults(env: NodeJS.ProcessEnv = process.env): WatchtowerConfig {
  const defaults: NodeJS.ProcessEnv = {
    RPC_URL: 'https://rpc.sepolia.org',
    CHAIN_ID: '11155111',
    SOLVER_REGISTRY_ADDRESS: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
    INTENT_RECEIPT_HUB_ADDRESS: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
    DISPUTE_MODULE_ADDRESS: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
    ...env,
  };

  return loadConfig(defaults);
}
