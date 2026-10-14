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

    async exportAuditCsv(serialNumber: string) {
        const dossier = await this.getAuditDossier(serialNumber);
        const lines: string[] = [];

        lines.push('PHARMATRACE-ES REGULATORY AUDIT & GXP COMPLIANCE DOSSIER');
        lines.push(`GeneratedAt,${new Date().toISOString()}`);
        lines.push(`DrugSerialNumber,${dossier.serialNumber}`);
        lines.push(`DrugName,"${dossier.drugName}"`);
        lines.push(`BatchNumber,${dossier.batchNumber}`);
        lines.push(`Manufacturer,"${dossier.manufacturer}"`);
        lines.push(`RegulatoryDisposition,${dossier.complianceSummary.disposition}`);
        lines.push(`GxPCompliancePercentage,${dossier.complianceSummary.compliancePercentage}%`);
        lines.push(`TotalLifecycleEvents,${dossier.complianceSummary.totalEvents}`);
        lines.push(`TotalTelemetryReadings,${dossier.complianceSummary.totalTelemetryPings}`);
        lines.push(`TemperatureRange,${dossier.complianceSummary.minTemperature}°C to ${dossier.complianceSummary.maxTemperature}°C (Average: ${dossier.complianceSummary.averageTemperature}°C)`);
        lines.push('');
        lines.push('Step,EventType,Timestamp,Handler,Role,Temperature,Humidity,Location,SignerAddress,EventHash');

        dossier.custodyTimeline.forEach((item) => {
            lines.push(
                `${item.step},${item.eventType},${item.timestamp},"${item.handler}",${item.role},${item.temperature ?? 'N/A'},${item.humidity ?? 'N/A'},"${item.location}",${item.signerAddress},${item.eventHash}`,
            );
        });

        return lines.join('\n');
    }
}