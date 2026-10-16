import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    Delete,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';

import { DrugEventsService } from './drug-events.service';
import { CreateDrugEventDto } from './dto/create-drug-event.dto';
import { EventType } from './event-type.enum';
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
    findAll(
        @Query('eventType') eventType?: EventType,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.drugEventsService.findAll({
            eventType,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }

    @Get('id/:id')
    findById(
        @Param('id') id: string,
    ) {
        return this.drugEventsService.findById(Number(id));
    }

    @Get(':serialNumber')
    findBySerialNumber(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugEventsService.executeGetQuery(
            serialNumber,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Put(':id/notes')
    updateNotes(
        @Param('id') id: string,
        @Body() body: { notes: string },
    ) {
        return this.drugEventsService.updateEventNotes(Number(id), body.notes);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':serialNumber')
    deleteBySerialNumber(
        @Param('serialNumber') serialNumber: string,
    ) {
        return this.drugEventsService.deleteBySerialNumber(serialNumber);
    }
}