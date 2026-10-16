import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from './entities/drug.entity';
import { ComplianceDossierBuilder } from './builders/compliance-dossier.builder';

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

    async getAllDrugs(query?: {
        manufacturer?: string;
        batchNumber?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: any = {};
        if (query?.manufacturer) {
            where.manufacturer = query.manufacturer;
        }
        if (query?.batchNumber) {
            where.batchNumber = query.batchNumber;
        }
        return this.drugRepository.find({
            where: Object.keys(where).length > 0 ? where : undefined,
            order: {
                id: 'ASC',
            },
            take: query?.limit ? Number(query.limit) : undefined,
            skip: query?.offset ? Number(query.offset) : undefined,
        });
    }

    async updateDrug(
        serialNumber: string,
        updateData: Partial<{
            drugName: string;
            manufacturer: string;
            batchNumber: string;
        }>,
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        if (updateData.drugName !== undefined) {
            drug.drugName = updateData.drugName;
        }
        if (updateData.manufacturer !== undefined) {
            drug.manufacturer = updateData.manufacturer;
        }
        if (updateData.batchNumber !== undefined) {
            drug.batchNumber = updateData.batchNumber;
        }
        return this.drugRepository.save(drug);
    }

    async deleteDrug(serialNumber: string) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        await this.drugRepository.remove(drug);
        return { deleted: true, serialNumber };
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

    async getAuditDossier(serialNumber: string) {
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

        const events = drug.events || [];
        return new ComplianceDossierBuilder()
            .setDrug(drug)
            .setEvents(events)
            .build();
    }

    private escapeCsvField(val: unknown): string {
        if (val === null || val === undefined) {
            return '""';
        }
        const str = String(val).replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(str)) {
            return `"'${str}"`;
        }
        return `"${str}"`;
    }

    async exportAuditCsv(serialNumber: string) {
        const dossier = await this.getAuditDossier(serialNumber);
        const lines: string[] = [];

        lines.push('PHARMATRACE-ES REGULATORY AUDIT & GXP COMPLIANCE DOSSIER');
        lines.push(`GeneratedAt,${new Date().toISOString()}`);
        lines.push(`DrugSerialNumber,${this.escapeCsvField(dossier.serialNumber)}`);
        lines.push(`DrugName,${this.escapeCsvField(dossier.drugName)}`);
        lines.push(`BatchNumber,${this.escapeCsvField(dossier.batchNumber)}`);
        lines.push(`Manufacturer,${this.escapeCsvField(dossier.manufacturer)}`);
        lines.push(`RegulatoryDisposition,${this.escapeCsvField(dossier.complianceSummary.disposition)}`);
        lines.push(`GxPCompliancePercentage,${dossier.complianceSummary.compliancePercentage}%`);
        lines.push(`TotalLifecycleEvents,${dossier.complianceSummary.totalEvents}`);
        lines.push(`TotalTelemetryReadings,${dossier.complianceSummary.totalTelemetryPings}`);
        lines.push(`TemperatureRange,${this.escapeCsvField(`${dossier.complianceSummary.minTemperature}°C to ${dossier.complianceSummary.maxTemperature}°C (Average: ${dossier.complianceSummary.averageTemperature}°C)`)}`);
        lines.push('');
        lines.push('Step,EventType,Timestamp,Handler,Role,Temperature,Humidity,Location,SignerAddress,EventHash');

        dossier.custodyTimeline.forEach((item) => {
            lines.push(
                `${item.step},${item.eventType},${item.timestamp},${this.escapeCsvField(item.handler)},${item.role},${item.temperature ?? 'N/A'},${item.humidity ?? 'N/A'},${this.escapeCsvField(item.location)},${item.signerAddress},${item.eventHash}`,
            );
        });

        return lines.join('\n');
    }
}