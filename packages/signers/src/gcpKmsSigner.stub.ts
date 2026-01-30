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
 * Configuration for GCP KMS signer
 */
export interface GcpKmsSignerConfig {
  /** GCP project ID */
  projectId: string;

  /** KMS location (e.g., 'us-central1') */
  location: string;

  /** KMS keyring name */
  keyring: string;

  /** KMS key name */
  key: string;

  /** KMS key version (defaults to 1) */
  keyVersion?: string;
}

/**
 * GCP Cloud KMS Signer (STUB)
 *
 * This is a stub implementation. Full implementation would:
 * 1. Use @google-cloud/kms to interact with Cloud KMS
 * 2. Sign digests using the asymmetric key
 * 3. Recover the Ethereum address from the public key
 *
 * Benefits of KMS:
 * - Keys never leave Google's HSMs
 * - Audit logging of all signing operations
 * - IAM-based access control
 * - Automatic key rotation support
 *
 * TODO: Implement full GCP KMS integration
 * Reference: https://cloud.google.com/kms/docs/signing-digests
 */
export class GcpKmsSigner implements Signer {
  private config: GcpKmsSignerConfig;

  constructor(config: GcpKmsSignerConfig) {
    this.config = config;
  }

  getType(): SignerType {
    return 'gcp-kms';
  }

  async getAddress(): Promise<Address> {
    // TODO: Implement - retrieve public key from KMS and derive address
    throw new Error(
      'GcpKmsSigner is a stub. Implementation pending. ' +
      `Config: project=${this.config.projectId}, keyring=${this.config.keyring}, key=${this.config.key}`
    );
  }

  async getAccount(): Promise<Account> {
    // TODO: Implement - create a viem Account that uses KMS for signing
    throw new Error('GcpKmsSigner.getAccount() not implemented');
  }

  async signTransaction(_tx: TransactionRequest): Promise<SignedTransaction> {
    // TODO: Implement
    // 1. Serialize transaction to RLP
    // 2. Hash with keccak256
    // 3. Sign digest with KMS
    // 4. Serialize signed transaction
    throw new Error('GcpKmsSigner.signTransaction() not implemented');
  }

  async signMessage(_message: SignableMessage): Promise<Hex> {
    // TODO: Implement
    // 1. Hash message with Ethereum signed message prefix
    // 2. Sign digest with KMS
    throw new Error('GcpKmsSigner.signMessage() not implemented');
  }

  async signTypedData(_data: TypedData): Promise<Hex> {
    // TODO: Implement
    // 1. Encode typed data per EIP-712
    // 2. Hash and sign with KMS
    throw new Error('GcpKmsSigner.signTypedData() not implemented');
  }

  async isHealthy(): Promise<boolean> {
    // TODO: Implement - check KMS connectivity and key availability
    return false;
  }

  /**
   * Get the KMS key resource name
   */
  getKeyResourceName(): string {
    const version = this.config.keyVersion ?? '1';
    return `projects/${this.config.projectId}/locations/${this.config.location}/keyRings/${this.config.keyring}/cryptoKeys/${this.config.key}/cryptoKeyVersions/${version}`;
  }
}

/**
 * Create a GCP KMS signer (stub)
 */
export function createGcpKmsSigner(config: GcpKmsSignerConfig): GcpKmsSigner {
  return new GcpKmsSigner(config);
}
