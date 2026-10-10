import {
    Controller,
    Get,
    Param,
} from '@nestjs/common';

import { LedgerService } from './ledger.service';

@Controller('ledger')
export class LedgerController {
    constructor(
        private readonly ledgerService: LedgerService,
    ) { }

    @Get()
    getLedger() {
        return this.ledgerService.getLedger();
    }

    @Get('verify')
    verifyLedger() {
        return {
            valid: this.ledgerService.verifyLedger(),
        };
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
}