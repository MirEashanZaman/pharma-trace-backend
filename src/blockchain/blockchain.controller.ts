import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

export class AnchorAttestationDto {
    dataHash: string;
    drugSerialNumber: string;
    eventType: string;
    signerAddress?: string;
    metadataUri?: string;
}

export class VerifySignatureDto {
    message: string;
    signature: string;
    address: string;
}

@Controller('blockchain')
export class BlockchainController {
    constructor(private readonly blockchainService: BlockchainService) {}

    @Post('attest')
    async anchorAttestation(@Body() dto: AnchorAttestationDto) {
        return this.blockchainService.anchorAttestation(
            dto.dataHash,
            dto.drugSerialNumber,
            dto.eventType,
            dto.signerAddress,
            dto.metadataUri
        );
    }

    @Get('verify/:hash')
    async verifyAttestation(@Param('hash') hash: string) {
        return this.blockchainService.verifyAttestation(hash);
    }

    @Get('history/:serialNumber')
    async getDrugHistory(@Param('serialNumber') serialNumber: string) {
        return this.blockchainService.getDrugAttestations(serialNumber);
    }

    @Post('verify-signature')
    verifySignature(@Body() dto: VerifySignatureDto) {
        const isValid = this.blockchainService.verifyWalletSignature(
            dto.message,
            dto.signature,
            dto.address
        );
        return { valid: isValid, address: dto.address };
    }

    @Post('tamper/:hash')
    tamperAttestation(@Param('hash') hash: string) {
        return {
            tampered: this.blockchainService.tamperAttestation(hash),
        };
    }
}
