import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { keccak256, toUtf8Bytes } from 'ethers';

export interface RevocationRecord {
  index: number;
  credentialId: string;
  revokedAt: number;
  revokedBy: string;
  reason: string;
}

@Injectable()
export class StatusList2021Registry {
  private readonly logger = new Logger(StatusList2021Registry.name);
  private readonly listSize: number = 100000;
  private readonly bits: Uint8Array = new Uint8Array(Math.ceil(this.listSize / 8));
  private readonly revocationAudit: Map<number, RevocationRecord> = new Map();
  private nextAvailableIndex: number = 0;

  allocateIndex(): number {
    if (this.nextAvailableIndex >= this.listSize) {
      throw new BadRequestException('StatusList2021 capacity exceeded');
    }
    const allocated = this.nextAvailableIndex;
    this.nextAvailableIndex += 1;
    return allocated;
  }

  revoke(
    index: number,
    credentialId: string,
    revokedBy: string,
    reason: string = 'Regulatory GxP Non-Compliance Revocation',
  ): { index: number; stateHash: string; record: RevocationRecord } {
    if (index < 0 || index >= this.listSize) {
      throw new BadRequestException(`Status list index ${index} out of bounds [0, ${this.listSize - 1}]`);
    }

    const byteIndex = Math.floor(index / 8);
    const bitPosition = index % 8;
    this.bits[byteIndex] |= 1 << bitPosition;

    const record: RevocationRecord = {
      index,
      credentialId,
      revokedAt: Date.now(),
      revokedBy,
      reason,
    };
    this.revocationAudit.set(index, record);

    const stateHash = this.computeStateHash();
    this.logger.warn(`Revoked credential ${credentialId} at status list index ${index}. State root: ${stateHash}`);

    return {
      index,
      stateHash,
      record,
    };
  }

  unrevoke(index: number, authorizedBy: string): { index: number; stateHash: string } {
    if (index < 0 || index >= this.listSize) {
      throw new BadRequestException(`Status list index ${index} out of bounds`);
    }

    const byteIndex = Math.floor(index / 8);
    const bitPosition = index % 8;
    this.bits[byteIndex] &= ~(1 << bitPosition);
    this.revocationAudit.delete(index);

    const stateHash = this.computeStateHash();
    this.logger.log(`Reinstated credential at status list index ${index} by ${authorizedBy}. State root: ${stateHash}`);

    return { index, stateHash };
  }

  isRevoked(index: number): boolean {
    if (index < 0 || index >= this.listSize) {
      return true;
    }
    const byteIndex = Math.floor(index / 8);
    const bitPosition = index % 8;
    return (this.bits[byteIndex] & (1 << bitPosition)) !== 0;
  }

  computeStateHash(): string {
    return keccak256(this.bits);
  }

  getRevocationRecord(index: number): RevocationRecord | undefined {
    return this.revocationAudit.get(index);
  }

  exportStatusListCredential(issuerDid: string): any {
    const encodedList = Buffer.from(this.bits.buffer, this.bits.byteOffset, this.bits.byteLength).toString('base64');

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/vc/status-list/2021/v1',
      ],
      id: `https://pharmatrace.org/status/list/1`,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: issuerDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: `https://pharmatrace.org/status/list/1#list`,
        type: 'StatusList2021',
        statusPurpose: 'revocation',
        encodedList,
      },
      stateHash: this.computeStateHash(),
      totalAllocated: this.nextAvailableIndex,
      totalRevoked: this.revocationAudit.size,
    };
  }
}
