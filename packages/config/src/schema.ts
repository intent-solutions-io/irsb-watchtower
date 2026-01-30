import { z } from 'zod';

/**
 * Ethereum address validation (0x + 40 hex chars)
 */
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/**
 * Private key validation (0x + 64 hex chars)
 */
const privateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format');

/**
 * Signer type enumeration
 */
export const signerTypeSchema = z.enum(['local', 'gcp-kms', 'lit-pkp']);
export type SignerType = z.infer<typeof signerTypeSchema>;

/**
 * Log level enumeration
 */
export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * Log format enumeration
 */
export const logFormatSchema = z.enum(['json', 'pretty']);
export type LogFormat = z.infer<typeof logFormatSchema>;

/**
 * Chain configuration schema
 */
export const chainConfigSchema = z.object({
  rpcUrl: z.string().url('RPC_URL must be a valid URL'),
  chainId: z.coerce.number().int().positive('CHAIN_ID must be a positive integer'),
});
export type ChainConfig = z.infer<typeof chainConfigSchema>;

/**
 * IRSB contract addresses schema
 */
export const irsbContractsSchema = z.object({
  solverRegistry: addressSchema,
  intentReceiptHub: addressSchema,
  disputeModule: addressSchema,
});
export type IrsbContracts = z.infer<typeof irsbContractsSchema>;

/**
 * Local signer configuration
 */
export const localSignerConfigSchema = z.object({
  type: z.literal('local'),
  privateKey: privateKeySchema,
});
export type LocalSignerConfig = z.infer<typeof localSignerConfigSchema>;

/**
 * GCP KMS signer configuration (stub)
 */
export const gcpKmsSignerConfigSchema = z.object({
  type: z.literal('gcp-kms'),
  projectId: z.string().min(1),
  location: z.string().min(1),
  keyring: z.string().min(1),
  key: z.string().min(1),
});
export type GcpKmsSignerConfig = z.infer<typeof gcpKmsSignerConfigSchema>;

/**
 * Lit PKP signer configuration (stub)
 */
export const litPkpSignerConfigSchema = z.object({
  type: z.literal('lit-pkp'),
  pkpPublicKey: z.string().min(1),
  authSig: z.string().min(1),
});
export type LitPkpSignerConfig = z.infer<typeof litPkpSignerConfigSchema>;

/**
 * Union of all signer configurations
 */
export const signerConfigSchema = z.discriminatedUnion('type', [
  localSignerConfigSchema,
  gcpKmsSignerConfigSchema,
  litPkpSignerConfigSchema,
]);
export type SignerConfig = z.infer<typeof signerConfigSchema>;

/**
 * API server configuration
 */
export const apiConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  enableActions: z.coerce.boolean().default(false),
});
export type ApiConfig = z.infer<typeof apiConfigSchema>;

/**
 * Worker configuration
 */
export const workerConfigSchema = z.object({
  scanIntervalMs: z.coerce.number().int().min(1000).default(60000),
  lookbackBlocks: z.coerce.number().int().min(1).default(1000),
  postToApi: z.coerce.boolean().default(false),
  apiUrl: z.string().url().optional(),
});
export type WorkerConfig = z.infer<typeof workerConfigSchema>;

/**
 * Logging configuration
 */
export const loggingConfigSchema = z.object({
  level: logLevelSchema.default('info'),
  format: logFormatSchema.default('pretty'),
});
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;

/**
 * Complete watchtower configuration
 */
export const watchtowerConfigSchema = z.object({
  chain: chainConfigSchema,
  contracts: irsbContractsSchema,
  signer: signerConfigSchema.optional(),
  api: apiConfigSchema,
  worker: workerConfigSchema,
  logging: loggingConfigSchema,
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});
export type WatchtowerConfig = z.infer<typeof watchtowerConfigSchema>;
