import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DrugsModule } from './drugs/drugs.module';
import { DrugEventsModule } from './events/drug-events.module';
import { IotModule } from './iot/iot.module';
import { LedgerModule } from './ledger/ledger.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),

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
    AuthModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }