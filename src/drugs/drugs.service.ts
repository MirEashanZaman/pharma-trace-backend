import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from './entities/drug.entity';

@Injectable()
export class DrugsService implements OnModuleInit {
    constructor(
        @InjectRepository(Drug)
        private readonly drugRepository: Repository<Drug>,
    ) { }

    async onModuleInit() {
        const count = await this.drugRepository.count();
        if (count === 0) {
            const testDrugs = [
                {
                    serialNumber: 'SN-2026-AMOX500',
                    drugName: 'Amoxicillin 500mg Capsule',
                    manufacturer: 'Novartis Global',
                    batchNumber: 'BATCH-2026-A1',
                },
                {
                    serialNumber: 'SN-2026-INSULIN100',
                    drugName: 'Recombinant Insulin 100IU/ml',
                    manufacturer: 'Novo Nordisk',
                    batchNumber: 'BATCH-2026-INS9',
                },
            ];
            for (const d of testDrugs) {
                await this.drugRepository.save(this.drugRepository.create(d));
            }
        }
    }

    async createDrug(data: {
        serialNumber: string;
        drugName: string;
        manufacturer: string;
        batchNumber: string;
    }) {
        const drug = this.drugRepository.create(data);

        return this.drugRepository.save(drug);
    }

    async getAllDrugs() {
        return this.drugRepository.find({
            order: {
                id: 'ASC',
            },
        });
    }

    async getDrugBySerialNumber(serialNumber: string) {
        const drug = await this.drugRepository.findOne({
            where: {
                serialNumber,
            },
        });

        if (!drug) {
            throw new NotFoundException(
                `Drug with serial number ${serialNumber} not found`,
            );
        }

        return drug;
    }

    async getDrugEvents(serialNumber: string) {
        const drug = await this.drugRepository.findOne({
            where: {
                serialNumber,
            },
            relations: {
                events: true,
            },
        });

        if (!drug) {
            throw new NotFoundException(
                `Drug with serial number ${serialNumber} not found`,
            );
        }

        return drug.events;
    }
}