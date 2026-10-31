import {
    Controller,
    Post,
    Body,
    Get,
    Put,
    Delete,
    Param,
    Query,
    Header,
    UseGuards,
} from '@nestjs/common';

import { DrugsService } from './drugs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('drugs')
export class DrugsController {
    constructor(
        private readonly drugsService: DrugsService,
    ) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN)
    @Post()
    createDrug(
        @Body()
        data: {
            serialNumber: string;
            drugName: string;
            manufacturer: string;
            batchNumber: string;
            dosageForm?: string;
            strength?: string;
            expiryDate?: string;
            apiSupplier?: string;
            apiCasNumber?: string;
            rawMaterialLot?: string;
        },
    ) {
        return this.drugsService.createDrug(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN)
    @Post('bulk')
    bulkCreateDrugs(
        @Body()
        data: {
            name: string;
            manufacturer: string;
            batchNumber: string;
            expiryDate?: string;
            quantity: number;
            dosageForm?: string;
            strength?: string;
            apiSupplier?: string;
            apiCasNumber?: string;
            rawMaterialLot?: string;
        },
    ) {
        return this.drugsService.bulkCreateDrugs(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN, UserRole.REGULATOR)
    @Post(':serialNumber/qc-release')
    submitQcRelease(
        @Param('serialNumber') serialNumber: string,
        @Body()
        qcData: {
            purityPercentage: number;
            phLevel: number;
            endotoxinLimit: string;
            disposition: 'QC_PASSED' | 'FAILED_QC';
            signedBy: string;
        },
    ) {
        return this.drugsService.submitQcRelease(serialNumber, qcData);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN)
    @Post(':serialNumber/dispatch')
    dispatchBatch(
        @Param('serialNumber') serialNumber: string,
        @Body()
        dispatchData: {
            carrierName: string;
            sealNumber?: string;
        },
    ) {
        return this.drugsService.dispatchBatch(serialNumber, dispatchData);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN, UserRole.REGULATOR)
    @Post('batch/:batchNumber/quarantine')
    quarantineBatch(
        @Param('batchNumber') batchNumber: string,
        @Body()
        body: {
            reason?: string;
        },
    ) {
        return this.drugsService.quarantineBatch(batchNumber, body?.reason);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
    @Post(':serialNumber/inbound-receive')
    receiveInbound(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            inspectionDisposition: 'ACCEPTED' | 'REJECTED';
            sealVerified: boolean;
            receivingTemp: number;
            notes?: string;
            inspectedBy: string;
            location: string;
            storageZone?: string;
        },
    ) {
        return this.drugsService.receiveInbound(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
    @Post(':serialNumber/assign-fleet')
    assignFleetVehicle(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            vehicleId: string;
            driverName: string;
            routeDestination: string;
            targetPharmacy?: string;
        },
    ) {
        return this.drugsService.assignFleetVehicle(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN)
    @Post('manifests/pharmacy-dispatch')
    createPharmacyManifest(
        @Body()
        data: {
            manifestId?: string;
            pharmacyName: string;
            pharmacyAddress: string;
            serialNumbers: string[];
            vehicleId: string;
            driverName: string;
            departureSeal: string;
        },
    ) {
        return this.drugsService.createPharmacyManifest(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DISTRIBUTOR, UserRole.PHARMACY, UserRole.ADMIN)
    @Post(':serialNumber/confirm-delivery')
    confirmPharmacyDelivery(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            pharmacistName: string;
            pharmacistLicense: string;
            deliveryTemp: number;
            signatureHash?: string;
            notes?: string;
        },
    ) {
        return this.drugsService.confirmPharmacyDelivery(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.PHARMACY, UserRole.ADMIN)
    @Post(':serialNumber/pharmacy-receive')
    pharmacyReceiveInbound(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            disposition: 'ACCEPTED' | 'REJECTED';
            receivingTemp: number;
            storageLocation: string;
            pharmacistName: string;
            pharmacistLicense: string;
            notes?: string;
            pharmacyName?: string;
        },
    ) {
        return this.drugsService.pharmacyReceiveInbound(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.PHARMACY, UserRole.ADMIN)
    @Post(':serialNumber/pharmacy-dispense')
    pharmacyDispensePrescription(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            prescriptionNumber: string;
            prescribingDoctor: string;
            patientToken: string;
            pharmacistName: string;
            notes?: string;
        },
    ) {
        return this.drugsService.pharmacyDispensePrescription(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.PHARMACY, UserRole.ADMIN)
    @Post(':serialNumber/pharmacy-retire')
    pharmacyDisposeOrReturn(
        @Param('serialNumber') serialNumber: string,
        @Body()
        data: {
            action: 'DESTROY' | 'RETURN';
            reason: string;
            witnessPharmacist?: string;
            certificateId?: string;
        },
    ) {
        return this.drugsService.pharmacyDisposeOrReturn(serialNumber, data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DISTRIBUTOR, UserRole.ADMIN, UserRole.REGULATOR)
    @Get('fleet/overview')
    getFleetOverview() {
        return this.drugsService.getFleetOverview();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.PHARMACY, UserRole.ADMIN, UserRole.REGULATOR)
    @Get('pharmacy/inventory-summary')
    getPharmacyInventorySummary() {
        return this.drugsService.pharmacyGetInventorySummary();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REGULATOR, UserRole.ADMIN)
    @Post('regulatory/facility-inspection')
    regulatorIssueFacilityInspection(
        @Body()
        data: {
            facility: string;
            citation: string;
            disposition: 'NAI' | 'VAI' | 'OAI';
            observationRef: string;
            inspectorBadge: string;
            notes?: string;
            batchNumber?: string;
        },
    ) {
        return this.drugsService.regulatorIssueFacilityInspection(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REGULATOR, UserRole.ADMIN)
    @Post('regulatory/enforce-recall')
    regulatorEnforceRecall(
        @Body()
        data: {
            target: string;
            isBatch: boolean;
            recallClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III';
            directiveRef: string;
            authority: string;
            reason: string;
        },
    ) {
        return this.drugsService.regulatorEnforceRecall(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REGULATOR, UserRole.ADMIN, UserRole.PHARMACY)
    @Post('regulatory/medwatch-ade')
    regulatorSubmitAdeReport(
        @Body()
        data: {
            serialNumber: string;
            adeReportId?: string;
            severity: 'LIFE_THREATENING' | 'HOSPITALIZATION' | 'DISABILITY' | 'MILD';
            reactionDetails: string;
            reporterRole: string;
        },
    ) {
        return this.drugsService.regulatorSubmitAdeReport(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REGULATOR, UserRole.ADMIN)
    @Post('regulatory/investigation-docket')
    regulatorUpdateInvestigationDocket(
        @Body()
        data: {
            serialNumber: string;
            docketNumber: string;
            disposition: 'SEIZED_CONFIRMED_COUNTERFEIT' | 'CLEARED_LEGITIMATE' | 'UNDER_INVESTIGATION';
            assayFindings: string;
            forensicNotes?: string;
        },
    ) {
        return this.drugsService.regulatorUpdateInvestigationDocket(data);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REGULATOR, UserRole.ADMIN)
    @Get('regulatory/alcoa-analysis')
    getRegulatorAlcoaAnalysis() {
        return this.drugsService.regulatorGetAlcoaAnalysis();
    }

    @Get()
    getAllDrugs(
        @Query('manufacturer') manufacturer?: string,
        @Query('batchNumber') batchNumber?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.drugsService.getAllDrugs({
            manufacturer,
            batchNumber,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }

    @Get(':serialNumber/events')
    getDrugEvents(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugsService.getDrugEvents(serialNumber);
    }

    @Get(':serialNumber/audit-dossier')
    getAuditDossier(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugsService.getAuditDossier(serialNumber);
    }

    @Get(':serialNumber/export-csv')
    @Header('Content-Type', 'text/csv')
    @Header('Content-Disposition', 'attachment; filename="regulatory-dossier.csv"')
    exportAuditCsv(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugsService.exportAuditCsv(serialNumber);
    }

    @Get(':serialNumber')
    getDrugBySerialNumber(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugsService.getDrugBySerialNumber(serialNumber);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MANUFACTURER, UserRole.ADMIN)
    @Put(':serialNumber')
    updateDrug(
        @Param('serialNumber') serialNumber: string,
        @Body()
        updateData: {
            drugName?: string;
            manufacturer?: string;
            batchNumber?: string;
            dosageForm?: string;
            strength?: string;
            expiryDate?: string;
            apiSupplier?: string;
            apiCasNumber?: string;
            rawMaterialLot?: string;
        },
    ) {
        return this.drugsService.updateDrug(serialNumber, updateData);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Delete(':serialNumber')
    deleteDrug(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugsService.deleteDrug(serialNumber);
    }
}
