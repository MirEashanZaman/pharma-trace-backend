import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { LedgerEntryEntity } from './entities/ledger-entry.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([LedgerEntryEntity]),
    ],
    controllers: [
        LedgerController,
    ],
    providers: [
        LedgerService,
    ],
    exports: [
        LedgerService,
    ],
})
export class LedgerModule { }
