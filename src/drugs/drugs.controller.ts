import {
    Controller,
    Post,
    Body,
    Get,
    Param,
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
    getAllDrugs() {
        return this.drugsService.getAllDrugs();
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
}