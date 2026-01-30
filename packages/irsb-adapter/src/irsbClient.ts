import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type Account,
} from 'viem';
import { sepolia } from 'viem/chains';
import type { IrsbContracts } from '@irsb-watchtower/config';
import {
  IntentReceiptHubAbi,
  SolverRegistryAbi,
} from './abi.js';
import type {
  OnChainReceipt,
  Solver,
  Dispute,
  OpenDisputeParams,
  SubmitEvidenceParams,
  ReceiptStatus,
  SolverStatus,
  DisputeStatus,
} from './types.js';

/**
 * Configuration for IRSB client
 */
export interface IrsbClientConfig {
  /** RPC URL */
  rpcUrl: string;

  /** Chain ID */
  chainId: number;

  /** Contract addresses */
  contracts: IrsbContracts;
}

/**
 * Status enum to string mapping
 */
function parseReceiptStatus(status: number): ReceiptStatus {
  const statuses: ReceiptStatus[] = ['pending', 'challenged', 'finalized', 'disputed'];
  return statuses[status] ?? 'pending';
}

function parseSolverStatus(status: number): SolverStatus {
  const statuses: SolverStatus[] = ['inactive', 'active', 'jailed', 'banned'];
  return statuses[status] ?? 'inactive';
}

function parseDisputeStatus(status: number): DisputeStatus {
  const statuses: DisputeStatus[] = ['open', 'countered', 'resolved', 'escalated'];
  return statuses[status] ?? 'open';
}

/**
 * IRSB Protocol Client
 *
 * Provides typed access to IRSB contract interactions
 */
export class IrsbClient {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private contracts: IrsbContracts;

  constructor(config: IrsbClientConfig) {
    this.contracts = config.contracts;

    // Get chain config
    const chain = config.chainId === 11155111 ? sepolia : {
      id: config.chainId,
      name: `Chain ${config.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    };

    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });
  }

  /**
   * Set up wallet client for write operations
   */
  setWalletClient(account: Account, rpcUrl: string): void {
    this.walletClient = createWalletClient({
      account,
      chain: sepolia, // TODO: dynamic chain
      transport: http(rpcUrl),
    });
  }

  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * Get receipt by ID
   */
  async getReceipt(receiptId: Hex): Promise<OnChainReceipt | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contracts.intentReceiptHub as Address,
        abi: IntentReceiptHubAbi,
        functionName: 'getReceipt',
        args: [receiptId],
      });

      const data = result as {
        intentHash: Hex;
        solverId: Hex;
        createdAt: bigint;
        expiry: bigint;
        challengeDeadline: bigint;
        status: number;
        finalized: boolean;
      };

      // Check if receipt exists (zero solverId means not found)
      if (data.solverId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return null;
      }

      return {
        id: receiptId,
        solverId: data.solverId,
        status: parseReceiptStatus(data.status),
        blockNumber: 0n, // Not available from this call
        txHash: '0x' as Hex, // Not available from this call
        challengeDeadline: data.challengeDeadline,
        finalized: data.finalized,
        intentHash: data.intentHash,
        createdAt: data.createdAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get solver by ID
   */
  async getSolver(solverId: Hex): Promise<Solver | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contracts.solverRegistry as Address,
        abi: SolverRegistryAbi,
        functionName: 'getSolver',
        args: [solverId],
      });

      const data = result as {
        owner: Address;
        bondAmount: bigint;
        status: number;
        reputation: number;
        jailCount: number;
        registeredAt: bigint;
        metadataUri: string;
      };

      // Check if solver exists
      if (data.owner === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        id: solverId,
        owner: data.owner,
        bondAmount: data.bondAmount,
        status: parseSolverStatus(data.status),
        reputation: data.reputation,
        jailCount: data.jailCount,
        registeredAt: data.registeredAt,
        metadataUri: data.metadataUri || undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: Hex): Promise<Dispute | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contracts.intentReceiptHub as Address,
        abi: IntentReceiptHubAbi,
        functionName: 'getDispute',
        args: [disputeId],
      });

      const data = result as {
        receiptId: Hex;
        challenger: Address;
        reason: string;
        evidenceHash: Hex;
        status: number;
        openedAt: bigint;
        deadline: bigint;
        challengerBond: bigint;
      };

      // Check if dispute exists
      if (data.challenger === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        id: disputeId,
        receiptId: data.receiptId,
        challenger: data.challenger,
        reason: data.reason,
        evidenceHash: data.evidenceHash,
        status: parseDisputeStatus(data.status),
        openedAt: data.openedAt,
        deadline: data.deadline,
        blockNumber: 0n, // Not available from this call
        challengerBond: data.challengerBond,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get challenge window duration
   */
  async getChallengeWindow(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.contracts.intentReceiptHub as Address,
      abi: IntentReceiptHubAbi,
      functionName: 'CHALLENGE_WINDOW',
    });
    return result as bigint;
  }

  /**
   * Get minimum bond requirement
   */
  async getMinimumBond(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.contracts.solverRegistry as Address,
      abi: SolverRegistryAbi,
      functionName: 'MINIMUM_BOND',
    });
    return result as bigint;
  }

  // ============================================================
  // Write Operations (require wallet client)
  // ============================================================

  /**
   * Open a dispute against a receipt
   */
  async openDispute(params: OpenDisputeParams): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client not configured. Call setWalletClient first.');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.contracts.intentReceiptHub as Address,
      abi: IntentReceiptHubAbi,
      functionName: 'openDispute',
      args: [params.receiptId, params.reason, params.evidenceHash],
      value: params.bondAmount,
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return hash;
  }

  /**
   * Submit evidence for a dispute
   */
  async submitEvidence(params: SubmitEvidenceParams): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client not configured. Call setWalletClient first.');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.contracts.intentReceiptHub as Address,
      abi: IntentReceiptHubAbi,
      functionName: 'submitEvidence',
      args: [params.disputeId, params.evidenceHash],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return hash;
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Get contract addresses
   */
  getContractAddresses(): IrsbContracts {
    return this.contracts;
  }

  /**
   * Get the public client for advanced queries
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }
}
