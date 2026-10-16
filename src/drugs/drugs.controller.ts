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
        },
    ) {
        return this.drugsService.createDrug(data);
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