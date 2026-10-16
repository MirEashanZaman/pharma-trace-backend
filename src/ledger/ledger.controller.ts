import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
} from '@nestjs/common';

import { LedgerService } from './ledger.service';

@Controller('ledger')
export class LedgerController {
    constructor(
        private readonly ledgerService: LedgerService,
    ) { }

    @Get()
    getLedger(
        @Query('drugSerialNumber') drugSerialNumber?: string,
        @Query('limit') limit?: string,
    ) {
        if (drugSerialNumber || limit) {
            return this.ledgerService.filterLedger(
                drugSerialNumber,
                limit ? Number(limit) : undefined,
            );
        }
        return this.ledgerService.getLedger();
    }

    @Get('verify')
    verifyLedger() {
        return {
            valid: this.ledgerService.verifyLedger(),
        };
    }

    @Get('entry/:index')
    getEntry(@Param('index') index: string) {
        const entry = this.ledgerService.getEntryByIndex(Number(index));
        return entry || { error: 'Entry not found' };
    }

    @Get('tamper/:index')
    tamperEntry(
        @Param('index') index: string,
    ) {
        const result =
            this.ledgerService.tamperEntry(
                Number(index),
            );

        return {
            tampered: result,
        };
    }

    @Post('entry')
    appendEntry(
        @Body()
        body: {
            drugSerialNumber: string;
            eventId: number;
            eventHash: string;
        },
    ) {
        return this.ledgerService.addEvent(
            body.drugSerialNumber,
            body.eventId,
            body.eventHash,
        );
    }

    @Put('entry/:index')
    updateEntry(
        @Param('index') index: string,
        @Body() body: { eventHash: string },
    ) {
        const success = this.ledgerService.updateEntryHash(
            Number(index),
            body.eventHash,
        );
        return { success, index: Number(index) };
    }

    @Delete('reset')
    resetLedger(@Query('confirm') confirm?: string) {
        if (confirm === 'true') {
            this.ledgerService.resetLedger();
            return { reset: true };
        }
        return { reset: false, message: 'Confirmation required' };
    }
}