import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface NfcRegisteredTag {
  tagUid: string;
  secretKey: Buffer;
  drugSerialNumber: string;
  lastTapCounter: number;
  registeredAt: number;
}

export interface NfcVerificationResult {
  isValid: boolean;
  reason?: string;
  drugSerialNumber?: string;
  tapCounter?: number;
  antiCloningVerified: boolean;
}

@Injectable()
export class NfcVerificationService {
  private readonly logger = new Logger(NfcVerificationService.name);
  private readonly tags: Map<string, NfcRegisteredTag> = new Map();

  registerTag(tagUid: string, secretKeyHex: string, drugSerialNumber: string): void {
    const cleanUid = tagUid.toLowerCase().replace(/[^a-f0-9]/g, '');
    if (cleanUid.length !== 14) {
      throw new BadRequestException('NTAG 424 DNA UID must be a 7-byte hexadecimal string (14 characters)');
    }

    const cleanKey = secretKeyHex.replace(/[^a-f0-9]/g, '');
    if (cleanKey.length !== 32) {
      throw new BadRequestException('Master AES-128 key must be a 16-byte hexadecimal string (32 characters)');
    }

    const tag: NfcRegisteredTag = {
      tagUid: cleanUid,
      secretKey: Buffer.from(cleanKey, 'hex'),
      drugSerialNumber,
      lastTapCounter: 0,
      registeredAt: Date.now(),
    };

    this.tags.set(cleanUid, tag);
    this.logger.log(`Registered dynamic NTAG 424 DNA chip for serial ${drugSerialNumber} (UID: ${cleanUid})`);
  }

  computeCmac(secretKey: Buffer, tagUid: string, tapCounter: number): string {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(tapCounter, 0);
    const data = Buffer.concat([Buffer.from(tagUid, 'hex'), counterBuf]);

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(data);
    return hmac.digest('hex').slice(0, 16);
  }

  generateSimulatedTagTap(tagUid: string): {
    tagUid: string;
    tapCounter: number;
    cmac: string;
    dynamicUrl: string;
  } {
    const cleanUid = tagUid.toLowerCase().replace(/[^a-f0-9]/g, '');
    const tag = this.tags.get(cleanUid);
    if (!tag) {
      throw new BadRequestException(`NFC Tag UID ${tagUid} is not registered`);
    }

    const nextCounter = tag.lastTapCounter + 1;
    const cmac = this.computeCmac(tag.secretKey, cleanUid, nextCounter);
    const dynamicUrl = `https://verify.pharmatrace.network/nfc?uid=${cleanUid}&ctr=${nextCounter}&cmac=${cmac}`;

    return {
      tagUid: cleanUid,
      tapCounter: nextCounter,
      cmac,
      dynamicUrl,
    };
  }

  verifyScan(tagUid: string, tapCounter: number, cmacHex: string): NfcVerificationResult {
    const cleanUid = tagUid.toLowerCase().replace(/[^a-f0-9]/g, '');
    const tag = this.tags.get(cleanUid);

    if (!tag) {
      return {
        isValid: false,
        reason: 'Unregistered NFC hardware tag UID',
        antiCloningVerified: false,
      };
    }

    if (tapCounter <= tag.lastTapCounter) {
      return {
        isValid: false,
        reason: `Replay / clone detection: Tap counter ${tapCounter} <= previous counter ${tag.lastTapCounter}`,
        drugSerialNumber: tag.drugSerialNumber,
        tapCounter,
        antiCloningVerified: false,
      };
    }

    const expectedCmac = this.computeCmac(tag.secretKey, cleanUid, tapCounter);
    if (cmacHex.toLowerCase() !== expectedCmac.toLowerCase()) {
      return {
        isValid: false,
        reason: 'Cryptographic CMAC signature mismatch: possible forged chip',
        drugSerialNumber: tag.drugSerialNumber,
        tapCounter,
        antiCloningVerified: false,
      };
    }

    tag.lastTapCounter = tapCounter;
    this.tags.set(cleanUid, tag);

    return {
      isValid: true,
      drugSerialNumber: tag.drugSerialNumber,
      tapCounter,
      antiCloningVerified: true,
    };
  }

  getTag(tagUid: string): NfcRegisteredTag | undefined {
    return this.tags.get(tagUid.toLowerCase().replace(/[^a-f0-9]/g, ''));
  }
}
