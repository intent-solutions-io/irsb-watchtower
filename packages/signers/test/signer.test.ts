import { describe, it, expect } from 'vitest';
import {
  LocalPrivateKeySigner,
  createLocalSigner,
  GcpKmsSigner,
  createGcpKmsSigner,
  LitPkpSigner,
  createLitPkpSigner,
} from '../src/index.js';

// Test private key (DO NOT use in production!)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('LocalPrivateKeySigner', () => {
  it('creates signer from private key', async () => {
    const signer = new LocalPrivateKeySigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    expect(signer.getType()).toBe('local');
    expect(await signer.getAddress()).toBe(TEST_ADDRESS);
  });

  it('creates signer using factory function', async () => {
    const signer = createLocalSigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    expect(await signer.getAddress()).toBe(TEST_ADDRESS);
  });

  it('signs messages', async () => {
    const signer = new LocalPrivateKeySigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    const signature = await signer.signMessage({
      raw: 'Hello, World!',
    });

    expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(signature.length).toBe(132); // 65 bytes = 130 hex chars + 0x
  });

  it('signs typed data (EIP-712)', async () => {
    const signer = new LocalPrivateKeySigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    const signature = await signer.signTypedData({
      domain: {
        name: 'Test',
        version: '1',
        chainId: 11155111,
      },
      types: {
        Message: [{ name: 'content', type: 'string' }],
      },
      primaryType: 'Message',
      message: {
        content: 'Hello',
      },
    });

    expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
  });

  it('reports healthy', async () => {
    const signer = new LocalPrivateKeySigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    expect(await signer.isHealthy()).toBe(true);
  });

  it('returns viem account', async () => {
    const signer = new LocalPrivateKeySigner({
      privateKey: TEST_PRIVATE_KEY,
    });

    const account = await signer.getAccount();
    expect(account.address).toBe(TEST_ADDRESS);
  });
});

describe('GcpKmsSigner (stub)', () => {
  it('creates stub signer', () => {
    const signer = createGcpKmsSigner({
      projectId: 'test-project',
      location: 'us-central1',
      keyring: 'test-keyring',
      key: 'test-key',
    });

    expect(signer.getType()).toBe('gcp-kms');
  });

  it('generates correct key resource name', () => {
    const signer = new GcpKmsSigner({
      projectId: 'my-project',
      location: 'us-central1',
      keyring: 'watchtower',
      key: 'dispute-signer',
      keyVersion: '2',
    });

    expect(signer.getKeyResourceName()).toBe(
      'projects/my-project/locations/us-central1/keyRings/watchtower/cryptoKeys/dispute-signer/cryptoKeyVersions/2'
    );
  });

  it('throws on getAddress (not implemented)', async () => {
    const signer = new GcpKmsSigner({
      projectId: 'test-project',
      location: 'us-central1',
      keyring: 'test-keyring',
      key: 'test-key',
    });

    await expect(signer.getAddress()).rejects.toThrow('stub');
  });

  it('reports unhealthy (not implemented)', async () => {
    const signer = new GcpKmsSigner({
      projectId: 'test-project',
      location: 'us-central1',
      keyring: 'test-keyring',
      key: 'test-key',
    });

    expect(await signer.isHealthy()).toBe(false);
  });
});

describe('LitPkpSigner (stub)', () => {
  it('creates stub signer', () => {
    const signer = createLitPkpSigner({
      pkpPublicKey: '0x1234567890abcdef',
      authSig: 'auth-signature',
    });

    expect(signer.getType()).toBe('lit-pkp');
  });

  it('returns correct lit network', () => {
    const signerDefault = new LitPkpSigner({
      pkpPublicKey: '0x1234',
      authSig: 'auth',
    });

    const signerCustom = new LitPkpSigner({
      pkpPublicKey: '0x1234',
      authSig: 'auth',
      litNetwork: 'habanero',
    });

    expect(signerDefault.getLitNetwork()).toBe('serrano');
    expect(signerCustom.getLitNetwork()).toBe('habanero');
  });

  it('throws on getAddress (not implemented)', async () => {
    const signer = new LitPkpSigner({
      pkpPublicKey: '0x1234',
      authSig: 'auth',
    });

    await expect(signer.getAddress()).rejects.toThrow('stub');
  });

  it('reports unhealthy (not implemented)', async () => {
    const signer = new LitPkpSigner({
      pkpPublicKey: '0x1234',
      authSig: 'auth',
    });

    expect(await signer.isHealthy()).toBe(false);
  });
});
