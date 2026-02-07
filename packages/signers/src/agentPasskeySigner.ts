import type { Address, Hex, Account } from 'viem';
import type {
  Signer,
  SignerType,
  TransactionRequest,
  SignedTransaction,
  SignableMessage,
  TypedData,
} from './signer.js';

/**
 * Configuration for Agent Passkey signer
 */
export interface AgentPasskeySignerConfig {
  /** Agent Passkey service endpoint */
  endpoint: string;

  /** Authentication token for the service */
  authToken?: string;

  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;

  /** Role identifier (watchtower, solver) */
  role?: 'watchtower' | 'solver';
}

/**
 * IRSB Action types supported by agent-passkey
 */
export type IrsbActionType = 'OPEN_DISPUTE' | 'SUBMIT_EVIDENCE' | 'SUBMIT_RECEIPT';

/**
 * Signing request for agent-passkey service
 */
export interface AgentPasskeyRequest {
  /** Action type */
  action: IrsbActionType;

  /** Chain ID */
  chainId: number;

  /** Action-specific payload */
  payload: Record<string, unknown>;

  /** Idempotency key (optional, prevents double-signing) */
  idempotencyKey?: string;
}

/**
 * Response from agent-passkey service
 */
export interface AgentPasskeyResponse {
  /** Whether the request was successful */
  success: boolean;

  /** Signed transaction (if success) */
  signedTx?: {
    rawTransaction: Hex;
    hash: Hex;
  };

  /** Transaction hash if broadcast by service */
  txHash?: Hex;

  /** Signer address */
  signerAddress?: Address;

  /** Audit artifact ID */
  auditId?: string;

  /** Error message (if failed) */
  error?: string;

  /** Policy denial reasons (if denied) */
  denyReasons?: string[];
}

/**
 * Agent Passkey Signer
 *
 * Uses the centralized irsb-agent-passkey service for signing.
 * This is the RECOMMENDED signer for production use.
 *
 * Benefits:
 * - Policy enforcement (allowlists, rate limits, spend caps)
 * - Lit Protocol PKP (2/3 threshold signatures across TEE nodes)
 * - Nonce management handled by service
 * - Audit artifacts for every signing decision
 * - No local key management required
 *
 * Environment variables:
 * - AGENT_PASSKEY_ENDPOINT: Service URL (default: production Cloud Run)
 * - AGENT_PASSKEY_AUTH_TOKEN: Authentication token
 * - AGENT_PASSKEY_ROLE: Role (watchtower | solver)
 * - AGENT_PASSKEY_TIMEOUT_MS: Request timeout (default: 30000)
 */
export class AgentPasskeySigner implements Signer {
  private config: Required<AgentPasskeySignerConfig>;
  private cachedAddress: Address | null = null;

  constructor(config: AgentPasskeySignerConfig) {
    this.config = {
      endpoint: config.endpoint,
      authToken: config.authToken ?? '',
      timeoutMs: config.timeoutMs ?? 30000,
      role: config.role ?? 'watchtower',
    };
  }

  getType(): SignerType {
    return 'agent-passkey' as SignerType;
  }

  async getAddress(): Promise<Address> {
    if (this.cachedAddress) {
      return this.cachedAddress;
    }

    // Fetch signer address from service
    const response = await this.callService('/info', 'GET');
    if (response.signerAddress) {
      this.cachedAddress = response.signerAddress;
      return response.signerAddress;
    }

    throw new Error('Failed to get signer address from agent-passkey service');
  }

  async getAccount(): Promise<Account> {
    // Agent-passkey doesn't expose a viem Account directly
    // The signing happens server-side
    throw new Error(
      'AgentPasskeySigner does not support getAccount(). ' +
      'Use signTransaction() or the typed action methods instead.'
    );
  }

  async signTransaction(_tx: TransactionRequest): Promise<SignedTransaction> {
    // For raw transactions, we need to wrap in an IRSB action
    // This should rarely be used - prefer typed actions
    throw new Error(
      'AgentPasskeySigner does not support raw signTransaction(). ' +
      'Use openDispute(), submitEvidence(), or submitReceipt() instead.'
    );
  }

  async signMessage(_message: SignableMessage): Promise<Hex> {
    throw new Error(
      'AgentPasskeySigner does not support signMessage(). ' +
      'All signing must go through typed IRSB actions.'
    );
  }

  async signTypedData(_data: TypedData): Promise<Hex> {
    throw new Error(
      'AgentPasskeySigner does not support signTypedData(). ' +
      'All signing must go through typed IRSB actions.'
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json() as { status?: string };
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Open a dispute (watchtower action)
   */
  async openDispute(params: {
    receiptId: string;
    evidenceHash: string;
    reasonCode: string;
    chainId: number;
    idempotencyKey?: string;
  }): Promise<AgentPasskeyResponse> {
    return this.callService('/sign', 'POST', {
      action: 'OPEN_DISPUTE',
      chainId: params.chainId,
      payload: {
        receiptId: params.receiptId,
        evidenceHash: params.evidenceHash,
        reasonCode: params.reasonCode,
      },
      idempotencyKey: params.idempotencyKey,
    });
  }

  /**
   * Submit evidence (watchtower or solver action)
   */
  async submitEvidence(params: {
    disputeId: string;
    evidenceHash: string;
    chainId: number;
    idempotencyKey?: string;
  }): Promise<AgentPasskeyResponse> {
    return this.callService('/sign', 'POST', {
      action: 'SUBMIT_EVIDENCE',
      chainId: params.chainId,
      payload: {
        disputeId: params.disputeId,
        evidenceHash: params.evidenceHash,
      },
      idempotencyKey: params.idempotencyKey,
    });
  }

  /**
   * Submit receipt (solver action)
   */
  async submitReceipt(params: {
    intentId: string;
    receiptHash: string;
    evidenceHash: string;
    chainId: number;
    idempotencyKey?: string;
  }): Promise<AgentPasskeyResponse> {
    return this.callService('/sign', 'POST', {
      action: 'SUBMIT_RECEIPT',
      chainId: params.chainId,
      payload: {
        intentId: params.intentId,
        receiptHash: params.receiptHash,
        evidenceHash: params.evidenceHash,
      },
      idempotencyKey: params.idempotencyKey,
    });
  }

  /**
   * Call the agent-passkey service
   */
  private async callService(
    path: string,
    method: 'GET' | 'POST',
    body?: AgentPasskeyRequest
  ): Promise<AgentPasskeyResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Role': this.config.role,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const response = await fetch(`${this.config.endpoint}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent-passkey request failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid response from agent-passkey service: expected object');
    }
    return data as AgentPasskeyResponse;
  }
}

/**
 * Create an Agent Passkey signer
 *
 * @example
 * ```typescript
 * const signer = createAgentPasskeySigner({
 *   endpoint: process.env.AGENT_PASSKEY_ENDPOINT,
 *   authToken: process.env.AGENT_PASSKEY_AUTH_TOKEN,
 *   role: 'watchtower',
 * });
 *
 * const result = await signer.openDispute({
 *   receiptId: '0x...',
 *   evidenceHash: '0x...',
 *   reasonCode: 'RECEIPT_STALE',
 *   chainId: 11155111,
 * });
 * ```
 */
export function createAgentPasskeySigner(config: AgentPasskeySignerConfig): AgentPasskeySigner {
  return new AgentPasskeySigner(config);
}

/**
 * Create an Agent Passkey signer from environment variables
 *
 * Required environment variables:
 * - AGENT_PASSKEY_ENDPOINT - Service URL (required, no default)
 *
 * Optional environment variables:
 * - AGENT_PASSKEY_AUTH_TOKEN - Authentication token
 * - AGENT_PASSKEY_ROLE - Role: 'watchtower' | 'solver' (default: watchtower)
 * - AGENT_PASSKEY_TIMEOUT_MS - Request timeout (default: 30000)
 *
 * @throws Error if AGENT_PASSKEY_ENDPOINT is not set
 */
export function createAgentPasskeySignerFromEnv(): AgentPasskeySigner {
  const endpoint = process.env['AGENT_PASSKEY_ENDPOINT'];
  if (!endpoint) {
    throw new Error('AGENT_PASSKEY_ENDPOINT environment variable is required');
  }

  const roleEnv = process.env['AGENT_PASSKEY_ROLE'];
  const role: 'watchtower' | 'solver' =
    roleEnv === 'solver' ? 'solver' : 'watchtower';

  const timeoutEnv = process.env['AGENT_PASSKEY_TIMEOUT_MS'];
  const timeoutMs = timeoutEnv ? parseInt(timeoutEnv, 10) : 30000;
  if (isNaN(timeoutMs) || timeoutMs < 1000) {
    throw new Error('AGENT_PASSKEY_TIMEOUT_MS must be a number >= 1000');
  }

  return new AgentPasskeySigner({
    endpoint,
    authToken: process.env['AGENT_PASSKEY_AUTH_TOKEN'],
    role,
    timeoutMs,
  });
}
