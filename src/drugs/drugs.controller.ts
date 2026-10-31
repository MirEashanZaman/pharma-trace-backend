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
