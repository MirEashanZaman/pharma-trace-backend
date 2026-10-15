import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

export class AnchorAttestationDto {
    @IsString()
    @IsNotEmpty()
    dataHash!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    drugSerialNumber!: string;

    @IsString()
    @IsNotEmpty()
    eventType!: string;

    @IsOptional()
    @IsString()
    signerAddress?: string;

    @IsOptional()
    @IsString()
    metadataUri?: string;
}

export class VerifySignatureDto {
    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsString()
    @IsNotEmpty()
    signature!: string;

    @IsString()
    @IsNotEmpty()
    address!: string;
}

@Controller('blockchain')
export class BlockchainController {
    constructor(private readonly blockchainService: BlockchainService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN, UserRole.REGULATOR)
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

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Post('tamper/:hash')
    tamperAttestation(@Param('hash') hash: string) {
        if (process.env.NODE_ENV === 'production') {
            throw new ForbiddenException('Tamper simulation endpoint is disabled in production');
        }
        return {
            tampered: this.blockchainService.tamperAttestation(hash),
        };
    }
}
