import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from './entities/drug.entity';

@Injectable()
export class DrugsService {
    constructor(
        @InjectRepository(Drug)
        private readonly drugRepository: Repository<Drug>,
    ) { }

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