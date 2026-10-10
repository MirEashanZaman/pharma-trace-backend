import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DrugsModule } from './drugs/drugs.module';
import { DrugEventsModule } from './events/drug-events.module';
import { IotModule } from './iot/iot.module';
import { LedgerModule } from './ledger/ledger.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '12345',
      database: 'pharma_trace',
      autoLoadEntities: true,
      synchronize: true,
    }),

    DrugsModule,
    DrugEventsModule,
    IotModule,
    LedgerModule,
    BlockchainModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule { }