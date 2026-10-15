import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { DrugEventsService } from './drug-events.service';
import { CreateDrugEventDto } from './dto/create-drug-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('drug-events')
export class DrugEventsController {
    constructor(
        private readonly drugEventsService: DrugEventsService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(
        @Body() body: CreateDrugEventDto,
        @Req() req?: any,
    ) {
        const userRole = req?.user?.role;
        return this.drugEventsService.executeCreateCommand(
            body,
            userRole,
        );
    }

    @Get()
    findAll() {
        return this.drugEventsService.findAll();
    }

    @Get(':serialNumber')
    findBySerialNumber(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugEventsService.executeGetQuery(
            serialNumber,
        );
    }
}