import { Injectable } from '@nestjs/common';
import { verifyTypedData } from 'ethers';

export interface EIP712DomainData {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
}

export interface CustodyTransferOffer {
    drugSerialNumber: string;
    fromAddress: string;
    toAddress: string;
    roleFrom: string;
    roleTo: string;
    nonce: number;
    expiry: number;
}

export interface CustodyTransferAccept {
    drugSerialNumber: string;
    fromAddress: string;
    toAddress: string;
    conditionAccepted: boolean;
    nonce: number;
    expiry: number;
}

export interface HandshakeValidationResult {
    isValid: boolean;
    reason?: string;
    offerVerified: boolean;
    acceptVerified: boolean;
    matchedSerial: string;
    parties: {
        from: string;
        to: string;
    };
}

export const CUSTODY_TYPED_DATA_TYPES = {
    CustodyTransferOffer: [
        { name: 'drugSerialNumber', type: 'string' },
        { name: 'fromAddress', type: 'address' },
        { name: 'toAddress', type: 'address' },
        { name: 'roleFrom', type: 'string' },
        { name: 'roleTo', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
    CustodyTransferAccept: [
        { name: 'drugSerialNumber', type: 'string' },
        { name: 'fromAddress', type: 'address' },
        { name: 'toAddress', type: 'address' },
        { name: 'conditionAccepted', type: 'bool' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
};

@Injectable()
export class Eip712CustodyService {
    getDomain(contractAddress: string = '0x0000000000000000000000000000000000000000', chainId: number = 31337): EIP712DomainData {
        return {
            name: 'PharmaTrace Attestation',
            version: '1.0.0',
            chainId,
            verifyingContract: contractAddress,
        };
    }

    verifyTransferOffer(
        offer: CustodyTransferOffer,
        signature: string,
        contractAddress?: string,
        chainId?: number,
    ): boolean {
        try {
            if (Date.now() > offer.expiry) {
                return false;
            }
            const domain = this.getDomain(contractAddress, chainId);
            const recovered = verifyTypedData(
                domain,
                { CustodyTransferOffer: CUSTODY_TYPED_DATA_TYPES.CustodyTransferOffer },
                offer,
                signature,
            );
            return recovered.toLowerCase() === offer.fromAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    verifyTransferAccept(
        accept: CustodyTransferAccept,
        signature: string,
        contractAddress?: string,
        chainId?: number,
    ): boolean {
        try {
            if (Date.now() > accept.expiry) {
                return false;
            }
            if (!accept.conditionAccepted) {
                return false;
            }
            const domain = this.getDomain(contractAddress, chainId);
            const recovered = verifyTypedData(
                domain,
                { CustodyTransferAccept: CUSTODY_TYPED_DATA_TYPES.CustodyTransferAccept },
                accept,
                signature,
            );
            return recovered.toLowerCase() === accept.toAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    validateDualCustodyHandshake(
        offer: CustodyTransferOffer,
        offerSignature: string,
        accept: CustodyTransferAccept,
        acceptSignature: string,
        contractAddress?: string,
        chainId?: number,
    ): HandshakeValidationResult {
        if (offer.drugSerialNumber !== accept.drugSerialNumber) {
            return {
                isValid: false,
                reason: 'Serial number mismatch between offer and acceptance',
                offerVerified: false,
                acceptVerified: false,
                matchedSerial: offer.drugSerialNumber,
                parties: { from: offer.fromAddress, to: offer.toAddress },
            };
        }

        if (offer.fromAddress.toLowerCase() !== accept.fromAddress.toLowerCase() ||
            offer.toAddress.toLowerCase() !== accept.toAddress.toLowerCase()) {
            return {
                isValid: false,
                reason: 'Party addresses mismatch between transfer parties',
                offerVerified: false,
                acceptVerified: false,
                matchedSerial: offer.drugSerialNumber,
                parties: { from: offer.fromAddress, to: offer.toAddress },
            };
        }

        const offerValid = this.verifyTransferOffer(offer, offerSignature, contractAddress, chainId);
        if (!offerValid) {
            return {
                isValid: false,
                reason: 'Invalid or expired transfer offer signature',
                offerVerified: false,
                acceptVerified: false,
                matchedSerial: offer.drugSerialNumber,
                parties: { from: offer.fromAddress, to: offer.toAddress },
            };
        }

        const acceptValid = this.verifyTransferAccept(accept, acceptSignature, contractAddress, chainId);
        if (!acceptValid) {
            return {
                isValid: false,
                reason: 'Invalid or expired transfer acceptance signature',
                offerVerified: true,
                acceptVerified: false,
                matchedSerial: offer.drugSerialNumber,
                parties: { from: offer.fromAddress, to: offer.toAddress },
            };
        }

        return {
            isValid: true,
            offerVerified: true,
            acceptVerified: true,
            matchedSerial: offer.drugSerialNumber,
            parties: { from: offer.fromAddress, to: offer.toAddress },
        };
    }
}
