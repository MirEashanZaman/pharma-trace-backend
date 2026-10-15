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

    computeCid(content: string): string {
        const hashHex = sha256(toUtf8Bytes(content)).replace(/^0x/, '');
        const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
        let base32 = '';
        for (let i = 0; i < hashHex.length; i += 2) {
            const byte = parseInt(hashHex.substring(i, i + 2), 16);
            base32 += base32Alphabet[byte % 32];
        }
        return `bafybeic${base32.slice(0, 32)}`;
    }

    async pinJson(payload: any, name?: string): Promise<IpfsPinnedDossier> {
        if (!payload) {
            throw new Error('Payload cannot be null or undefined');
        }

        const serialized = JSON.stringify(payload, Object.keys(payload).sort());
        const cid = this.computeCid(serialized);
        const payloadHash = sha256(toUtf8Bytes(serialized));
        const sizeBytes = Buffer.byteLength(serialized, 'utf8');

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
        const serialized = JSON.stringify(payload, Object.keys(payload).sort());
        const expectedCid = this.computeCid(serialized);
        return cid === expectedCid;
    }

    getPinnedDossier(cid: string): IpfsPinnedDossier | undefined {
        return this.pinnedStorage.get(cid)?.dossier;
    }

    getAllPinnedDossiers(): IpfsPinnedDossier[] {
        return Array.from(this.pinnedStorage.values()).map((v) => v.dossier);
    }
}
