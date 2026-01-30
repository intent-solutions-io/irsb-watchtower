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
 * Configuration for Lit Protocol PKP signer
 */
export interface LitPkpSignerConfig {
  /** PKP public key */
  pkpPublicKey: string;

  /** Authentication signature for Lit actions */
  authSig: string;

  /** Lit network (e.g., 'serrano', 'jalapeno', 'habanero') */
  litNetwork?: string;
}

/**
 * Lit Protocol PKP Signer (STUB)
 *
 * This is a stub implementation. Full implementation would:
 * 1. Use @lit-protocol/lit-node-client
 * 2. Authenticate with Lit nodes using authSig
 * 3. Request PKP signatures through Lit Actions
 *
 * Benefits of Lit PKP:
 * - Decentralized key management (no single point of failure)
 * - Programmable signing conditions (Lit Actions)
 * - Cross-chain compatibility
 * - No centralized custody
 *
 * TODO: Implement full Lit Protocol integration
 * Reference: https://developer.litprotocol.com/
 */
export class LitPkpSigner implements Signer {
  private config: LitPkpSignerConfig;

  constructor(config: LitPkpSignerConfig) {
    this.config = config;
  }

  getType(): SignerType {
    return 'lit-pkp';
  }

  async getAddress(): Promise<Address> {
    // TODO: Implement - derive address from PKP public key
    throw new Error(
      'LitPkpSigner is a stub. Implementation pending. ' +
      `PKP public key: ${this.config.pkpPublicKey.slice(0, 20)}...`
    );
  }

  async getAccount(): Promise<Account> {
    // TODO: Implement - create a viem Account that uses Lit PKP for signing
    throw new Error('LitPkpSigner.getAccount() not implemented');
  }

  async signTransaction(_tx: TransactionRequest): Promise<SignedTransaction> {
    // TODO: Implement
    // 1. Serialize transaction
    // 2. Create Lit Action request
    // 3. Execute signing through Lit nodes
    // 4. Aggregate signatures and return
    throw new Error('LitPkpSigner.signTransaction() not implemented');
  }

  async signMessage(_message: SignableMessage): Promise<Hex> {
    // TODO: Implement
    // 1. Format message for signing
    // 2. Request signature through Lit Action
    throw new Error('LitPkpSigner.signMessage() not implemented');
  }

  async signTypedData(_data: TypedData): Promise<Hex> {
    // TODO: Implement
    // 1. Encode typed data per EIP-712
    // 2. Request signature through Lit Action
    throw new Error('LitPkpSigner.signTypedData() not implemented');
  }

  async isHealthy(): Promise<boolean> {
    // TODO: Implement - check Lit network connectivity
    return false;
  }

  /**
   * Get the Lit network being used
   */
  getLitNetwork(): string {
    return this.config.litNetwork ?? 'serrano';
  }
}

/**
 * Create a Lit PKP signer (stub)
 */
export function createLitPkpSigner(config: LitPkpSignerConfig): LitPkpSigner {
  return new LitPkpSigner(config);
}
