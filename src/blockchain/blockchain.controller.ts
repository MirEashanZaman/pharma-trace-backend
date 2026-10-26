import {
    Body,
    Controller,
    Get,
    Put,
    Delete,
    Param,
    Post,
    Query,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { BlockchainService } from './blockchain.service';
import { IpfsService } from './ipfs/ipfs.service';
import { ZkProofEngine } from './zk/zk-proof.engine';
import { PaymasterService } from './account-abstraction/paymaster.service';
import { BundlerService } from './account-abstraction/bundler.service';
import { SoulboundAccreditationService } from './sbt/soulbound-accreditation.service';
import { DigitalTwinService } from './digital-twin/digital-twin.service';
import { PharmaEscrowService } from './escrow/pharma-escrow.service';
import { DidResolverService } from './did/did-resolver.service';
import { EpcisJsonLdService } from './epcis/epcis-jsonld.service';
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
    constructor(
        private readonly blockchainService: BlockchainService,
        private readonly ipfsService: IpfsService,
        private readonly zkProofEngine: ZkProofEngine,
        private readonly paymasterService: PaymasterService,
        private readonly soulboundService: SoulboundAccreditationService,
        private readonly digitalTwinService: DigitalTwinService,
        private readonly escrowService: PharmaEscrowService,
        private readonly didResolverService: DidResolverService,
        private readonly epcisJsonLdService: EpcisJsonLdService,
        private readonly bundlerService: BundlerService,
    ) {}

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

    @Get('attestations')
    async queryAttestations(
        @Query('serialNumber') serialNumber?: string,
        @Query('limit') limit?: string,
    ) {
        if (serialNumber) {
            const records = await this.blockchainService.getDrugAttestations(serialNumber);
            return limit ? records.slice(0, Number(limit)) : records;
        }
        return [];
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

    @Post('ipfs/pin')
    async pinDossier(@Body() body: { payload: any; name?: string }) {
        return this.ipfsService.pinJson(body.payload, body.name);
    }

    @Get('ipfs')
    async listDossiers(@Query('limit') limit?: string) {
        const all = this.ipfsService.getAllPinnedDossiers();
        return limit ? all.slice(0, Number(limit)) : all;
    }

    @Get('ipfs/:cid')
    async getDossier(@Param('cid') cid: string) {
        return this.ipfsService.retrieveJson(cid);
    }

    @Put('ipfs/:cid')
    async updateDossier(
        @Param('cid') cid: string,
        @Body() body: { name: string },
    ) {
        return this.ipfsService.updateDossierMetadata(cid, body.name);
    }

    @Delete('ipfs/:cid')
    async deleteDossier(@Param('cid') cid: string) {
        return {
            unpinned: this.ipfsService.unpinJson(cid),
            cid,
        };
    }

    @Post('zk/cold-chain-proof')
    generateColdChainProof(
        @Body() body: { readings: number[]; minTemp?: number; maxTemp?: number; batchHash?: string }
    ) {
        return this.zkProofEngine.generateColdChainProof(
            body.readings,
            body.minTemp ?? 2.0,
            body.maxTemp ?? 8.0,
            body.batchHash
        );
    }

    @Post('zk/verify-cold-chain')
    verifyColdChainProof(@Body() proof: any) {
        return this.zkProofEngine.verifyColdChainProof(proof);
    }

    @Post('paymaster/sponsor')
    async sponsorUserOp(
        @Body() body: { userOp: any; actionName: string }
    ) {
        return this.paymasterService.sponsorUserOperation(body.userOp, body.actionName);
    }

    @Get('sbt/badges/:recipient')
    getBadges(@Param('recipient') recipient: string) {
        return this.soulboundService.getBadgesForHolder(recipient);
    }

    @Get('sbt/verify/:tokenId')
    async verifyBadge(@Param('tokenId') tokenId: string) {
        return this.soulboundService.verifyBadge(tokenId);
    }

    @Post('twin/mint')
    async mintTwin(@Body() dto: any) {
        return this.digitalTwinService.mintDigitalTwin(dto);
    }

    @Post('twin/transfer')
    async transferTwinCustody(
        @Body() body: { serialNumber: string; fromAddress: string; toAddress: string }
    ) {
        return this.digitalTwinService.transferCustody(body.serialNumber, body.fromAddress, body.toAddress);
    }

    @Post('twin/burn')
    async burnTwinOnDispense(
        @Body() body: { serialNumber: string; dispenserAddress: string }
    ) {
        return this.digitalTwinService.burnOnDispense(body.serialNumber, body.dispenserAddress);
    }

    @Get('twin/verify/:serialNumber')
    async verifyTwin(@Param('serialNumber') serialNumber: string) {
        return this.digitalTwinService.verifyAuthenticity(serialNumber);
    }

    @Post('escrow/create')
    async createEscrow(@Body() dto: any) {
        return this.escrowService.createEscrowOrder(dto);
    }

    @Post('escrow/release')
    async releaseEscrow(
        @Body() body: { orderId: string; custodyAccepted: boolean; coldChainReadings: number[]; minTemp?: number; maxTemp?: number }
    ) {
        return this.escrowService.evaluateAndReleaseEscrow(
            body.orderId,
            body.custodyAccepted,
            body.coldChainReadings,
            body.minTemp,
            body.maxTemp,
        );
    }

    @Post('escrow/evaluate-consensus')
    async evaluateEscrowWithConsensus(@Body() body: any) {
        return this.escrowService.evaluateAndReleaseWithConsensus(
            body.orderId,
            body.custodyAccepted,
            body.checkpointClusters,
            body.minTemp,
            body.maxTemp,
            body.outlierTolerance,
        );
    }

    @Post('escrow/refund')
    async refundEscrow(@Body() body: { orderId: string; reason: string }) {
        return this.escrowService.triggerBreachRefund(body.orderId, body.reason);
    }

    @Get('escrow/automation/check')
    async checkEscrowAutomation() {
        return this.escrowService.checkAutomationUpkeep();
    }

    @Post('escrow/automation/perform')
    async performEscrowAutomation(@Body() body: { orderId: string; actionType: number }) {
        return this.escrowService.performAutomationUpkeep(body.orderId, body.actionType);
    }

    @Get('escrow/:orderId')
    async getEscrow(@Param('orderId') orderId: string) {
        return this.escrowService.getEscrow(orderId);
    }

    @Get('did/:did')
    async resolveDid(@Param('did') did: string) {
        return this.didResolverService.resolveDid(did);
    }

    @Get('did/address/:address')
    async resolveDidByAddress(@Param('address') address: string) {
        return this.didResolverService.resolveAddress(address);
    }

    @Post('did/verify-signature')
    verifyDidSignature(@Body() body: { did: string; message: string; signature: string }) {
        const valid = this.didResolverService.verifyDidSignature(body.did, body.message, body.signature);
        return { valid, did: body.did };
    }

    @Post('epcis/commission')
    commissionEpcis(@Body() body: any) {
        const event = this.epcisJsonLdService.buildCommissioningEvent(body);
        const doc = this.epcisJsonLdService.wrapDocument([event]);
        return this.epcisJsonLdService.canonicalizeAndHash(doc);
    }

    @Post('epcis/aggregate')
    aggregateEpcis(@Body() body: any) {
        const event = this.epcisJsonLdService.buildAggregationEvent(body);
        const doc = this.epcisJsonLdService.wrapDocument([event]);
        return this.epcisJsonLdService.canonicalizeAndHash(doc);
    }

    @Post('epcis/dispense')
    dispenseEpcis(@Body() body: any) {
        const event = this.epcisJsonLdService.buildDispenseEvent(body);
        const doc = this.epcisJsonLdService.wrapDocument([event]);
        return this.epcisJsonLdService.canonicalizeAndHash(doc);
    }

    @Post('epcis/canonicalize')
    canonicalizeDocument(@Body() doc: any) {
        return this.epcisJsonLdService.canonicalizeAndHash(doc);
    }

    @Post('aa/estimate-gas')
    estimateUserOpGas(@Body() userOp: any) {
        return this.bundlerService.estimateUserOpGas(userOp);
    }

    @Post('aa/sponsor')
    async sponsorUserOpForBundler(@Body() body: { userOp: any; actionName: string }) {
        return this.paymasterService.sponsorUserOperation(body.userOp, body.actionName);
    }

    @Post('aa/send-userop')
    sendUserOp(@Body() userOp: any) {
        return this.bundlerService.sendUserOperation(userOp);
    }

    @Post('aa/bundle-and-execute')
    async bundleAndExecute(@Body() body?: { maxBatchSize?: number; beneficiary?: string }) {
        const bundle = this.bundlerService.createBundle(body?.maxBatchSize || 10, body?.beneficiary);
        return this.bundlerService.executeBundle(bundle);
    }

    @Get('aa/receipt/:hash')
    getUserOpReceipt(@Param('hash') hash: string) {
        return this.bundlerService.getUserOpReceipt(hash);
    }

    @Get('aa/mempool')
    getMempoolStatus() {
        return this.bundlerService.getMempoolStatus();
    }

    @Post('escrow/automation/poll')
    pollEscrowAutomation() {
        return this.escrowService.pollAndExecuteUpkeep();
    }
}


