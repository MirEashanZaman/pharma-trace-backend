export interface AttestationAnchor {
    dataHash: string;
    drugSerialNumber: string;
    eventType: string;
    signer: string;
    timestamp: number;
    transactionHash?: string;
    blockNumber?: number;
    isRevoked: boolean;
    metadataUri?: string;
}

export interface VerifyAttestationResult {
    exists: boolean;
    isValid: boolean;
    drugSerialNumber: string;
    eventType: string;
    signer: string;
    timestamp: number;
    metadataUri: string;
    onChain: boolean;
    transactionHash?: string;
    explorerUrl?: string;
}
