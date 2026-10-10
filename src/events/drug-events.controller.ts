import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
} from '@nestjs/common';

import { DrugEventsService } from './drug-events.service';

import { CreateDrugEventDto } from './dto/create-drug-event.dto';

@Controller('drug-events')
export class DrugEventsController {
    constructor(
        private readonly drugEventsService: DrugEventsService,
    ) { }

    @Post()
    create(
        @Body() body: CreateDrugEventDto,
    ) {
        return this.drugEventsService.executeCreateCommand(
            body,
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

    @Delete(':serialNumber')
    deleteBySerialNumber(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugEventsService.deleteBySerialNumber(
            serialNumber,
        );
    }
}