import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { createHash } from 'crypto';

import { DrugEvent } from './entities/drug-event.entity';
import { Drug } from '../drugs/entities/drug.entity';

import { CreateDrugEventDto } from './dto/create-drug-event.dto';
import { EventType } from './event-type.enum';

import { EventPublisher } from './publishers/event.publisher';

import { CreateDrugEventCommand } from './commands/create-drug-event.command';
import { GetDrugEventsQuery } from './queries/get-drug-events.query';

import { CustodyTransferSaga } from './saga/custody-transfer.saga';

import { LedgerService } from '../ledger/ledger.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DrugEventsService {
    constructor(
        @InjectRepository(DrugEvent)
        private readonly drugEventRepository:
            Repository<DrugEvent>,

        @InjectRepository(Drug)
        private readonly drugRepository:
            Repository<Drug>,

        private readonly eventPublisher:
            EventPublisher,

        private readonly custodyTransferSaga:
            CustodyTransferSaga,

        private readonly ledgerService:
            LedgerService,

        private readonly blockchainService:
            BlockchainService,
    ) { }

    async executeCreateCommand(
        data: CreateDrugEventDto,
        userRole?: string,
    ) {
        const command =
            new CreateDrugEventCommand(data);

        return this.create(command.data, userRole);
    }

    async create(
        data: CreateDrugEventDto,
        userRole?: string,
    ) {
        const drug =
            await this.drugRepository.findOne({
                where: {
                    serialNumber:
                        data.drugSerialNumber,
                },
            });

        if (!drug) {
            throw new NotFoundException(
                `Drug with serial number ${data.drugSerialNumber} not found`,
            );
        }

        const previousEventRecord =
            await this.drugEventRepository.findOne({
                where: {
                    drugSerialNumber:
                        data.drugSerialNumber,
                },

                order: {
                    createdAt: 'DESC',
                },
            });

        const previousEvent =
            previousEventRecord
                ? previousEventRecord.eventType
                : null;

        const roleToValidate =
            userRole ||
            (data.eventData && (data.eventData as any).userRole) ||
            undefined;

        this.custodyTransferSaga.validateTransition(
            previousEvent,
            data.eventType,
            roleToValidate,
        );

        if (data.eventType === EventType.SOLD) {
            this.custodyTransferSaga.validateMultiSignatureDispensing(data.eventData);
        }

        const event =
            this.drugEventRepository.create({
                ...data,
                drug,
            });

        const eventHash =
            createHash('sha256')
                .update(
                    JSON.stringify({
                        drugSerialNumber:
                            data.drugSerialNumber,

                        eventType:
                            data.eventType,

                        eventData:
                            data.eventData,
                    }),
                )
                .digest('hex');

        event.eventHash = eventHash;

        const savedEvent =
            await this.drugEventRepository.save(
                event,
            );

        this.eventPublisher.publish(
            savedEvent,
        );

        this.ledgerService.addEvent(
            savedEvent.drugSerialNumber,
            savedEvent.id,
            savedEvent.eventHash,
        );

        await this.blockchainService.anchorAttestation(
            savedEvent.eventHash,
            savedEvent.drugSerialNumber,
            savedEvent.eventType,
            data.eventData && (data.eventData as any).signerAddress
                ? (data.eventData as any).signerAddress
                : undefined,
            data.eventData && (data.eventData as any).metadataUri
                ? (data.eventData as any).metadataUri
                : undefined
        );

        return savedEvent;
    }

    async executeGetQuery(
        serialNumber: string,
    ) {
        const query =
            new GetDrugEventsQuery(
                serialNumber,
            );

        return this.findBySerialNumber(
            query.serialNumber,
        );
    }

    findAll(query?: {
        eventType?: EventType;
        limit?: number;
        offset?: number;
    }) {
        const where: any = {};
        if (query?.eventType) {
            where.eventType = query.eventType;
        }
        return this.drugEventRepository.find({
            where: Object.keys(where).length > 0 ? where : undefined,
            relations: {
                drug: true,
            },
            order: {
                createdAt: 'ASC',
            },
            take: query?.limit ? Number(query.limit) : undefined,
            skip: query?.offset ? Number(query.offset) : undefined,
        });
    }

    async findById(id: number) {
        const event = await this.drugEventRepository.findOne({
            where: { id },
            relations: { drug: true },
        });
        if (!event) {
            throw new NotFoundException(`Drug event with id ${id} not found`);
        }
        return event;
    }

    async updateEventNotes(id: number, notes: string) {
        const event = await this.findById(id);
        if (event.eventData && typeof event.eventData === 'object') {
            (event.eventData as any).notes = notes;
        } else {
            event.eventData = { notes };
        }
        return this.drugEventRepository.save(event);
    }

    findBySerialNumber(
        serialNumber: string,
    ) {
        return this.drugEventRepository.find({
            where: {
                drugSerialNumber:
                    serialNumber,
            },

            relations: {
                drug: true,
            },

            order: {
                createdAt: 'ASC',
            },
        });
    }

    deleteBySerialNumber(
        serialNumber: string,
    ) {
        return this.drugEventRepository.delete({
            drugSerialNumber:
                serialNumber,
        });
    }
}