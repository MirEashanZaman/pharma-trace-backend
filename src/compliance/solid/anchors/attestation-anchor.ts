import { createHash } from 'crypto';
import { AnchorReceipt } from '../compliance.types';

export abstract class AbstractAttestationAnchor {
  abstract anchor(batchId: string, digest: string): Promise<AnchorReceipt>;
  abstract verify(batchId: string, digest: string): Promise<boolean>;
}

export class DirectOnChainAnchor extends AbstractAttestationAnchor {
  private readonly anchoredLedger: Map<string, AnchorReceipt> = new Map();

  async anchor(batchId: string, digest: string): Promise<AnchorReceipt> {
    const key = `${batchId}:${digest}`;
    const txHash = '0x' + createHash('sha256').update(`direct:${key}:${Date.now()}`).digest('hex');
    const receipt: AnchorReceipt = {
      anchorId: `anchor-direct-${Date.now()}`,
      batchId,
      digest,
      txHash,
      blockNumber: Math.floor(18000000 + Math.random() * 10000),
      timestamp: Date.now(),
      mode: 'DIRECT',
    };
    this.anchoredLedger.set(key, receipt);
    return receipt;
  }

  async verify(batchId: string, digest: string): Promise<boolean> {
    const key = `${batchId}:${digest}`;
    return this.anchoredLedger.has(key);
  }
}

export class MerkleBatchedAnchor extends AbstractAttestationAnchor {
  private readonly rootLedger: Map<string, string> = new Map();
  private readonly proofStore: Map<string, string[]> = new Map();

  async anchor(batchId: string, digest: string): Promise<AnchorReceipt> {
    const syntheticProof = [
      '0x' + createHash('sha256').update(digest + 'sibling_1').digest('hex'),
      '0x' + createHash('sha256').update(digest + 'sibling_2').digest('hex'),
    ];

    let currentHash = digest;
    for (const sibling of syntheticProof) {
      currentHash =
        '0x' +
        createHash('sha256')
          .update(currentHash + sibling)
          .digest('hex');
    }

    const merkleRoot = currentHash;
    const txHash = '0x' + createHash('sha256').update(`merkle:${merkleRoot}:${Date.now()}`).digest('hex');

    this.rootLedger.set(batchId, merkleRoot);
    this.proofStore.set(`${batchId}:${digest}`, syntheticProof);

    return {
      anchorId: `anchor-merkle-${Date.now()}`,
      batchId,
      digest,
      txHash,
      blockNumber: Math.floor(18000000 + Math.random() * 10000),
      timestamp: Date.now(),
      mode: 'MERKLE_BATCH',
    };
  }

  async verify(batchId: string, digest: string): Promise<boolean> {
    const root = this.rootLedger.get(batchId);
    const proof = this.proofStore.get(`${batchId}:${digest}`);

    if (!root || !proof) {
      return false;
    }

    let currentHash = digest;
    for (const sibling of proof) {
      currentHash =
        '0x' +
        createHash('sha256')
          .update(currentHash + sibling)
          .digest('hex');
    }

    return currentHash === root;
  }
}
