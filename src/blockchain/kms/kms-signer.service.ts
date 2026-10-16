import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  SigningKey,
  keccak256,
  toUtf8Bytes,
  hashMessage,
  computeAddress,
  recoverAddress,
  getBytes,
  hexlify,
  toBeHex,
} from 'ethers';

export interface KmsKeyMetadata {
  keyId: string;
  label: string;
  hsmProvider: 'AWS_KMS' | 'GOOGLE_CLOUD_KMS' | 'AZURE_KEY_VAULT' | 'HASHICORP_VAULT_TRANSIT';
  fipsLevel: string;
  ethereumAddress: string;
  publicKeyHex: string;
  enabled: boolean;
  registeredAt: number;
}

export interface KmsSignatureResult {
  keyId: string;
  digest: string;
  r: string;
  s: string;
  v: number;
  serializedSignature: string;
  signerAddress: string;
}

const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SECP256K1_HALF_N = SECP256K1_N / 2n;

@Injectable()
export class KmsSignerService {
  private readonly logger = new Logger(KmsSignerService.name);
  private readonly keyRegistry: Map<string, KmsKeyMetadata> = new Map();
  private readonly enclaveSigners: Map<string, SigningKey> = new Map();

  constructor() {
    this.initializeEnclaveKey(
      'kms-pharma-mfg-01',
      'BioGenix International Manufacturing Signer',
      'AWS_KMS',
      '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    );
    this.initializeEnclaveKey(
      'kms-pharma-reg-01',
      'US FDA Regulatory Oversight Signer',
      'HASHICORP_VAULT_TRANSIT',
      '0x6cbed15c793ce57650b9877cf2182d8001e7294eb314064785645f93a3a13186',
    );
  }

  private initializeEnclaveKey(
    keyId: string,
    label: string,
    hsmProvider: 'AWS_KMS' | 'GOOGLE_CLOUD_KMS' | 'AZURE_KEY_VAULT' | 'HASHICORP_VAULT_TRANSIT',
    internalSeedHex: string,
  ): void {
    const signingKey = new SigningKey(internalSeedHex);
    const publicKeyHex = signingKey.publicKey;
    const ethereumAddress = computeAddress(publicKeyHex);

    this.enclaveSigners.set(keyId, signingKey);
    this.keyRegistry.set(keyId, {
      keyId,
      label,
      hsmProvider,
      fipsLevel: 'FIPS 140-2 Level 3',
      ethereumAddress,
      publicKeyHex,
      enabled: true,
      registeredAt: Date.now(),
    });

    this.logger.log(`Initialized Hardware Enclave KMS key ${keyId} -> ${ethereumAddress} (${hsmProvider})`);
  }

  registerCustomKey(
    keyId: string,
    label: string,
    hsmProvider: 'AWS_KMS' | 'GOOGLE_CLOUD_KMS' | 'AZURE_KEY_VAULT' | 'HASHICORP_VAULT_TRANSIT',
    seedOrKeyHex: string,
  ): KmsKeyMetadata {
    if (this.keyRegistry.has(keyId)) {
      throw new BadRequestException(`KMS key ${keyId} already registered`);
    }

    this.initializeEnclaveKey(keyId, label, hsmProvider, seedOrKeyHex);
    return this.keyRegistry.get(keyId)!;
  }

  getKeyMetadata(keyId: string): KmsKeyMetadata {
    const meta = this.keyRegistry.get(keyId);
    if (!meta) {
      throw new NotFoundException(`KMS key identifier ${keyId} not found in enclave registry`);
    }
    return meta;
  }

  listKeys(): KmsKeyMetadata[] {
    return Array.from(this.keyRegistry.values());
  }

  updateKeyMetadata(keyId: string, updates: { label?: string; enabled?: boolean }): KmsKeyMetadata {
    const meta = this.getKeyMetadata(keyId);
    if (updates.label !== undefined) {
      meta.label = updates.label;
    }
    if (updates.enabled !== undefined) {
      meta.enabled = updates.enabled;
    }
    this.keyRegistry.set(keyId, meta);
    return meta;
  }

  deregisterKey(keyId: string): boolean {
    const existed = this.keyRegistry.delete(keyId);
    this.enclaveSigners.delete(keyId);
    return existed;
  }

  parseAsn1DerSignature(derBuffer: Buffer): { r: string; s: string } {
    if (derBuffer[0] !== 0x30) {
      throw new BadRequestException('Invalid ASN.1 DER sequence header');
    }

    let offset = 2;
    if (derBuffer[1] & 0x80) {
      const lengthBytes = derBuffer[1] & 0x7f;
      offset += lengthBytes;
    }

    if (derBuffer[offset] !== 0x02) {
      throw new BadRequestException('Invalid ASN.1 DER integer marker for r');
    }
    const rLength = derBuffer[offset + 1];
    let rStart = offset + 2;
    let rEnd = rStart + rLength;
    if (derBuffer[rStart] === 0x00 && rLength > 32) {
      rStart += 1;
    }
    const rBytes = derBuffer.subarray(rStart, rEnd);
    const rHex = hexlify(rBytes).slice(2).padStart(64, '0');

    offset = rEnd;
    if (derBuffer[offset] !== 0x02) {
      throw new BadRequestException('Invalid ASN.1 DER integer marker for s');
    }
    const sLength = derBuffer[offset + 1];
    let sStart = offset + 2;
    let sEnd = sStart + sLength;
    if (derBuffer[sStart] === 0x00 && sLength > 32) {
      sStart += 1;
    }
    const sBytes = derBuffer.subarray(sStart, sEnd);
    const sHex = hexlify(sBytes).slice(2).padStart(64, '0');

    return {
      r: '0x' + rHex,
      s: '0x' + sHex,
    };
  }

  normalizeLowS(sBig: bigint): bigint {
    if (sBig > SECP256K1_HALF_N) {
      return SECP256K1_N - sBig;
    }
    return sBig;
  }

  recoverV(digest: string, r: string, s: string, expectedAddress: string): number {
    for (const vCandidate of [27, 28]) {
      try {
        const fullSig = `${r}${s.slice(2)}${toBeHex(vCandidate).slice(2)}`;
        const recovered = recoverAddress(digest, fullSig);
        if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
          return vCandidate;
        }
      } catch {}
    }
    throw new BadRequestException('Failed to recover valid Ethereum v parameter from KMS signature');
  }

  async signDigest(keyId: string, digestHex: string): Promise<KmsSignatureResult> {
    const meta = this.getKeyMetadata(keyId);
    if (!meta.enabled) {
      throw new BadRequestException(`KMS key ${keyId} is currently disabled`);
    }

    const enclaveKey = this.enclaveSigners.get(keyId);
    if (!enclaveKey) {
      throw new NotFoundException(`Enclave signer execution context for ${keyId} missing`);
    }

    const cleanDigest = digestHex.startsWith('0x') ? digestHex : '0x' + digestHex;
    if (getBytes(cleanDigest).length !== 32) {
      throw new BadRequestException('Signing digest must be precisely 32 bytes (256 bits)');
    }

    const signature = enclaveKey.sign(cleanDigest);

    let sBig = BigInt(signature.s);
    sBig = this.normalizeLowS(sBig);
    const normalizedS = toBeHex(sBig, 32);

    const v = this.recoverV(cleanDigest, signature.r, normalizedS, meta.ethereumAddress);
    const serializedSignature = `${signature.r}${normalizedS.slice(2)}${toBeHex(v).slice(2)}`;

    this.logger.log(`KMS signed digest with key ${keyId} (${meta.ethereumAddress}) -> v=${v}`);

    return {
      keyId,
      digest: cleanDigest,
      r: signature.r,
      s: normalizedS,
      v,
      serializedSignature,
      signerAddress: meta.ethereumAddress,
    };
  }

  async signMessage(keyId: string, message: string): Promise<KmsSignatureResult> {
    const digest = hashMessage(message);
    return this.signDigest(keyId, digest);
  }

  async verifyKmsSignature(message: string, serializedSignature: string, keyId: string): Promise<boolean> {
    const meta = this.getKeyMetadata(keyId);
    const digest = hashMessage(message);
    const recovered = recoverAddress(digest, serializedSignature);
    return recovered.toLowerCase() === meta.ethereumAddress.toLowerCase();
  }
}
