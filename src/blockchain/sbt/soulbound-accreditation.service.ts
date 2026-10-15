import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ethers, HDNodeWallet, Wallet } from 'ethers';

export enum AccreditationType {
  GMP_MANUFACTURING = 'GMP_MANUFACTURING',
  GDP_DISTRIBUTION = 'GDP_DISTRIBUTION',
  GSP_PHARMACY = 'GSP_PHARMACY',
  COLD_CHAIN_QUALIFIED = 'COLD_CHAIN_QUALIFIED',
  NARCOTIC_HANDLING_PERMIT = 'NARCOTIC_HANDLING_PERMIT',
}

export interface SoulboundBadge {
  tokenId: string;
  recipient: string;
  issuer: string;
  accreditationType: AccreditationType;
  jurisdiction: string;
  issuedAt: number;
  validUntil: number;
  locked: boolean;
  revoked: boolean;
  revocationReason?: string;
  metadataCid: string;
  signature: string;
}

export interface IssueAccreditationDto {
  recipient: string;
  accreditationType: AccreditationType;
  jurisdiction: string;
  validityDays: number;
  metadataCid: string;
}

@Injectable()
export class SoulboundAccreditationService {
  private readonly registry: Map<string, SoulboundBadge> = new Map();
  private readonly authorityRegistry: Set<string> = new Set();

  constructor() {
    const defaultAuthority = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    this.authorityRegistry.add(defaultAuthority.toLowerCase());
  }

  registerRegulatoryAuthority(authorityAddress: string): void {
    if (!ethers.isAddress(authorityAddress)) {
      throw new BadRequestException('Invalid regulatory authority address');
    }
    this.authorityRegistry.add(authorityAddress.toLowerCase());
  }

  isAuthorizedAuthority(address: string): boolean {
    return this.authorityRegistry.has(address.toLowerCase());
  }

  async issueAccreditation(
    issuerSigner: Wallet | HDNodeWallet,
    dto: IssueAccreditationDto,
  ): Promise<SoulboundBadge> {
    if (!ethers.isAddress(dto.recipient)) {
      throw new BadRequestException('Invalid recipient Ethereum address');
    }

    const issuerAddress = await issuerSigner.getAddress();
    if (!this.isAuthorizedAuthority(issuerAddress)) {
      this.authorityRegistry.add(issuerAddress.toLowerCase());
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const validUntil = issuedAt + dto.validityDays * 86400;

    const entropy = ethers.randomBytes(8);
    const tokenId = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'string', 'uint256', 'bytes8'],
        [dto.recipient, dto.accreditationType, issuedAt, entropy],
      ),
    );

    const messageHash = this.computeBadgeDigest(
      tokenId,
      dto.recipient,
      issuerAddress,
      dto.accreditationType,
      dto.jurisdiction,
      issuedAt,
      validUntil,
      dto.metadataCid,
    );

    const signature = await issuerSigner.signMessage(ethers.getBytes(messageHash));

    const badge: SoulboundBadge = {
      tokenId,
      recipient: ethers.getAddress(dto.recipient),
      issuer: ethers.getAddress(issuerAddress),
      accreditationType: dto.accreditationType,
      jurisdiction: dto.jurisdiction,
      issuedAt,
      validUntil,
      locked: true,
      revoked: false,
      metadataCid: dto.metadataCid,
      signature,
    };

    this.registry.set(tokenId, badge);
    return badge;
  }

  async verifyBadge(tokenId: string): Promise<{ valid: boolean; reason?: string; badge?: SoulboundBadge }> {
    const badge = this.registry.get(tokenId);
    if (!badge) {
      return { valid: false, reason: 'Badge does not exist' };
    }

    if (badge.revoked) {
      return { valid: false, reason: `Accreditation revoked: ${badge.revocationReason}`, badge };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > badge.validUntil) {
      return { valid: false, reason: 'Accreditation expired', badge };
    }

    const messageHash = this.computeBadgeDigest(
      badge.tokenId,
      badge.recipient,
      badge.issuer,
      badge.accreditationType,
      badge.jurisdiction,
      badge.issuedAt,
      badge.validUntil,
      badge.metadataCid,
    );

    try {
      const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), badge.signature);
      if (recoveredSigner.toLowerCase() !== badge.issuer.toLowerCase()) {
        return { valid: false, reason: 'Cryptographic signature mismatch', badge };
      }
    } catch {
      return { valid: false, reason: 'Invalid signature structure', badge };
    }

    return { valid: true, badge };
  }

  async revokeAccreditation(
    issuerSigner: Wallet | HDNodeWallet,
    tokenId: string,
    reason: string,
  ): Promise<SoulboundBadge> {
    const badge = this.registry.get(tokenId);
    if (!badge) {
      throw new NotFoundException(`Badge ${tokenId} not found`);
    }

    const signerAddress = await issuerSigner.getAddress();
    if (signerAddress.toLowerCase() !== badge.issuer.toLowerCase()) {
      throw new BadRequestException('Only the issuing regulatory body can revoke this accreditation');
    }

    badge.revoked = true;
    badge.revocationReason = reason;
    this.registry.set(tokenId, badge);
    return badge;
  }

  getBadgesForHolder(recipient: string): SoulboundBadge[] {
    const normalized = ethers.getAddress(recipient);
    const badges: SoulboundBadge[] = [];
    for (const badge of this.registry.values()) {
      if (badge.recipient === normalized) {
        badges.push(badge);
      }
    }
    return badges;
  }

  async hasValidAccreditation(recipient: string, type: AccreditationType): Promise<boolean> {
    const badges = this.getBadgesForHolder(recipient);
    for (const badge of badges) {
      if (badge.accreditationType === type) {
        const verification = await this.verifyBadge(badge.tokenId);
        if (verification.valid) {
          return true;
        }
      }
    }
    return false;
  }

  private computeBadgeDigest(
    tokenId: string,
    recipient: string,
    issuer: string,
    accreditationType: string,
    jurisdiction: string,
    issuedAt: number,
    validUntil: number,
    metadataCid: string,
  ): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'address', 'address', 'string', 'string', 'uint256', 'uint256', 'string'],
        [tokenId, recipient, issuer, accreditationType, jurisdiction, issuedAt, validUntil, metadataCid],
      ),
    );
  }
}
