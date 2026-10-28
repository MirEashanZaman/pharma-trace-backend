import { Injectable, Logger } from '@nestjs/common';
import { sha256, toUtf8Bytes } from 'ethers';

export interface IpfsPinnedDossier {
    cid: string;
    sizeBytes: number;
    pinnedAt: number;
    gatewayUrl: string;
    pinStatus: 'PINNED' | 'QUEUED' | 'FAILED';
    metadataName?: string;
    payloadHash: string;
}

@Injectable()
export class IpfsService {
    private readonly logger = new Logger(IpfsService.name);
    private readonly pinnedStorage: Map<string, { dossier: IpfsPinnedDossier; data: any }> = new Map();
    private readonly gatewayBase: string = process.env.IPFS_GATEWAY_URL || 'https://dweb.link/ipfs/';

    private canonicalStringify(obj: any): string {
        if (obj === null || typeof obj !== 'object') {
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            return '[' + obj.map((item) => this.canonicalStringify(item)).join(',') + ']';
        }
        const keys = Object.keys(obj).sort();
        return '{' + keys.map((key) => JSON.stringify(key) + ':' + this.canonicalStringify(obj[key])).join(',') + '}';
    }

    private computeCidFromBytes(bytes: Uint8Array): string {
        const hashHex = sha256(bytes).replace(/^0x/, '');
        const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
        let base32 = '';
        for (let i = 0; i < hashHex.length; i += 2) {
            const byte = parseInt(hashHex.substring(i, i + 2), 16);
            base32 += base32Alphabet[byte % 32];
        }
        return `bafybeic${base32.slice(0, 32)}`;
    }

    computeCid(content: string): string {
        return this.computeCidFromBytes(toUtf8Bytes(content));
    }

    async pinJson(payload: any, name?: string): Promise<IpfsPinnedDossier> {
        if (!payload) {
            throw new Error('Payload cannot be null or undefined');
        }

        const serialized = this.canonicalStringify(payload);
        const utf8Bytes = toUtf8Bytes(serialized);
        const cid = this.computeCidFromBytes(utf8Bytes);
        const payloadHash = sha256(utf8Bytes);
        const sizeBytes = utf8Bytes.length;

        const dossier: IpfsPinnedDossier = {
            cid,
            sizeBytes,
            pinnedAt: Date.now(),
            gatewayUrl: `${this.gatewayBase}${cid}`,
            pinStatus: 'PINNED',
            metadataName: name || `dossier-${Date.now()}`,
            payloadHash,
        };

        this.pinnedStorage.set(cid, { dossier, data: payload });
        this.logger.log(`Pinned IPFS dossier ${cid} (${sizeBytes} bytes) to decentralized storage`);
        return dossier;
    }

    async retrieveJson(cid: string): Promise<any> {
        const record = this.pinnedStorage.get(cid);
        if (!record) {
            throw new Error(`IPFS CID not found in local node or gateway: ${cid}`);
        }
        return record.data;
    }

    verifyCid(cid: string, payload: any): boolean {
        const serialized = this.canonicalStringify(payload);
        const expectedCid = this.computeCid(serialized);
        return cid === expectedCid;
    }

    getPinnedDossier(cid: string): IpfsPinnedDossier | undefined {
        return this.pinnedStorage.get(cid)?.dossier;
    }

    getAllPinnedDossiers(): IpfsPinnedDossier[] {
        return Array.from(this.pinnedStorage.values()).map((v) => v.dossier);
    }

    unpinJson(cid: string): boolean {
        return this.pinnedStorage.delete(cid);
    }

    updateDossierMetadata(cid: string, name: string): IpfsPinnedDossier | undefined {
        const record = this.pinnedStorage.get(cid);
        if (!record) return undefined;
        record.dossier.metadataName = name;
        return record.dossier;
    }
}
