import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from './entities/drug.entity';
import { ComplianceDossierBuilder } from './builders/compliance-dossier.builder';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';

@Injectable()
export class DrugsService implements OnModuleInit {
    constructor(
        @InjectRepository(Drug)
        private readonly drugRepository: Repository<Drug>,
        @Optional()
        private readonly redisService?: RedisService,
    ) { }

    async onModuleInit() {
        const testDrugs = [
            {
                serialNumber: 'DRUG-001',
                drugName: 'Insulin Injection',
                manufacturer: 'PharmaCare Ltd.',
                batchNumber: 'BATCH-2026-001',
                dosageForm: 'Injectable Solution',
                strength: '100 IU/mL',
                expiryDate: '2027-12-31',
                qcStatus: 'RELEASED_FOR_TRANSIT',
                qcPurityPercentage: 99.85,
                qcPhLevel: 7.35,
                qcEndotoxinLimit: '< 0.2 EU/mL',
                currentCustodian: 'DHL Healthcare Logistics',
                custodyLocation: 'DHL Apex Cross-Dock Facility, Bay 4',
                inboundInspectionStatus: 'ACCEPTED_AT_DOCK',
                storageZone: 'ZONE_A_COLD_2_8',
                assignedVehicleId: 'VAN-408',
            },
            {
                serialNumber: 'DRUG-002',
                drugName: 'Pfizer COVID-19 Vaccine',
                manufacturer: 'Pfizer-BioNTech',
                batchNumber: 'BATCH-2026-002',
                dosageForm: 'Suspension for Injection',
                strength: '30 mcg/0.3mL',
                expiryDate: '2027-06-30',
                qcStatus: 'RELEASED_FOR_TRANSIT',
                qcPurityPercentage: 99.92,
                qcPhLevel: 7.20,
                qcEndotoxinLimit: '< 0.1 EU/mL',
                currentCustodian: 'DHL Healthcare Logistics',
                custodyLocation: 'Cold-Room Vault A - Ultra-Cold Zone',
                inboundInspectionStatus: 'ACCEPTED_AT_DOCK',
                storageZone: 'ZONE_B_FREEZER',
                assignedVehicleId: 'TRUCK-112',
            },
            {
                serialNumber: 'SN-2026-AMOX500',
                drugName: 'Amoxicillin 500mg Capsule',
                manufacturer: 'Novartis Global',
                batchNumber: 'BATCH-2026-A1',
                dosageForm: 'Oral Capsule',
                strength: '500 mg',
                expiryDate: '2028-01-15',
                qcStatus: 'RELEASED_FOR_TRANSIT',
                qcPurityPercentage: 99.78,
                qcPhLevel: 6.80,
                qcEndotoxinLimit: '< 0.25 EU/mL',
                currentCustodian: 'DHL Healthcare Logistics',
                custodyLocation: 'DHL Apex Cross-Dock Facility, Bay 4',
                inboundInspectionStatus: 'ACCEPTED_AT_DOCK',
                storageZone: 'ZONE_A_COLD_2_8',
                assignedVehicleId: 'VAN-408',
            },
            {
                serialNumber: 'SN-2026-INSULIN',
                drugName: 'Recombinant Insulin 100IU/ml',
                manufacturer: 'Novo Nordisk',
                batchNumber: 'BATCH-2026-INS9',
                dosageForm: 'Injectable Cartridge',
                strength: '100 IU/mL',
                expiryDate: '2027-09-15',
                qcStatus: 'RELEASED_FOR_TRANSIT',
                qcPurityPercentage: 99.94,
                qcPhLevel: 7.40,
                qcEndotoxinLimit: '< 0.05 EU/mL',
                currentCustodian: 'DHL Healthcare Logistics',
                custodyLocation: 'DHL Metro Delivery Fleet',
                inboundInspectionStatus: 'ACCEPTED_AT_DOCK',
                storageZone: 'ZONE_A_COLD_2_8',
                assignedVehicleId: 'SHUTTLE-07',
            },
        ];
        for (const d of testDrugs) {
            const exists = await this.drugRepository.findOne({ where: { serialNumber: d.serialNumber } });
            if (!exists) {
                await this.drugRepository.save(this.drugRepository.create(d));
            }
        }
    }

    async createDrug(data: {
        serialNumber: string;
        drugName: string;
        manufacturer: string;
        batchNumber: string;
        dosageForm?: string;
        strength?: string;
        expiryDate?: string;
        apiSupplier?: string;
        apiCasNumber?: string;
        rawMaterialLot?: string;
    }) {
        const drug = this.drugRepository.create({
            ...data,
            qcStatus: 'LAB_QUARANTINE',
        });
        const saved = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.set(`drug:${saved.serialNumber}`, saved, 120);
        }
        return saved;
    }

    async bulkCreateDrugs(data: {
        name: string;
        manufacturer: string;
        batchNumber: string;
        expiryDate?: string;
        quantity: number;
        dosageForm?: string;
        strength?: string;
        apiSupplier?: string;
        apiCasNumber?: string;
        rawMaterialLot?: string;
    }) {
        const count = Math.min(Math.max(1, data.quantity || 1), 100);
        const createdDrugs: Drug[] = [];
        for (let i = 1; i <= count; i++) {
            const serialNumber = `${data.batchNumber}-SN${String(i).padStart(3, '0')}`;
            const existing = await this.drugRepository.findOne({ where: { serialNumber } });
            if (!existing) {
                const drug = this.drugRepository.create({
                    serialNumber,
                    drugName: data.name,
                    manufacturer: data.manufacturer,
                    batchNumber: data.batchNumber,
                    expiryDate: data.expiryDate,
                    dosageForm: data.dosageForm,
                    strength: data.strength,
                    apiSupplier: data.apiSupplier,
                    apiCasNumber: data.apiCasNumber,
                    rawMaterialLot: data.rawMaterialLot,
                    qcStatus: 'LAB_QUARANTINE',
                });
                createdDrugs.push(drug);
            }
        }
        const saved = await this.drugRepository.save(createdDrugs);
        if (this.redisService) {
            for (const item of saved) {
                await this.redisService.set(`drug:${item.serialNumber}`, item, 120);
            }
        }
        return saved;
    }

    async submitQcRelease(
        serialNumber: string,
        qcData: {
            purityPercentage: number;
            phLevel: number;
            endotoxinLimit: string;
            disposition: 'QC_PASSED' | 'FAILED_QC';
            signedBy: string;
        },
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        const timestamp = new Date().toISOString();
        const payload = JSON.stringify({
            serialNumber,
            batchNumber: drug.batchNumber,
            ...qcData,
            timestamp,
        });
        const certHash = createHash('sha256').update(payload).digest('hex');

        drug.qcPurityPercentage = Number(qcData.purityPercentage);
        drug.qcPhLevel = Number(qcData.phLevel);
        drug.qcEndotoxinLimit = qcData.endotoxinLimit;
        drug.qcStatus = qcData.disposition === 'QC_PASSED' ? 'RELEASED_FOR_TRANSIT' : 'FAILED_QC';
        drug.qcCertHash = certHash;
        drug.qcSignedBy = qcData.signedBy;
        drug.qcSignedAt = new Date();

        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
    }

    async dispatchBatch(
        serialNumber: string,
        dispatchData: {
            carrierName: string;
            sealNumber?: string;
        },
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        if (drug.qcStatus !== 'RELEASED_FOR_TRANSIT') {
            throw new BadRequestException(
                `Drug batch has not passed QC certification. Current status: ${drug.qcStatus}`,
            );
        }
        drug.carrierName = dispatchData.carrierName;
        drug.sealNumber = dispatchData.sealNumber;
        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
    }

    async quarantineBatch(batchNumber: string, reason?: string) {
        const drugs = await this.drugRepository.find({
            where: { batchNumber },
        });
        if (!drugs.length) {
            throw new NotFoundException(`No drugs found for batch ${batchNumber}`);
        }
        for (const drug of drugs) {
            drug.qcStatus = 'QUARANTINED';
            drug.isRecalled = true;
        }
        await this.drugRepository.save(drugs);
        if (this.redisService) {
            for (const d of drugs) {
                await this.redisService.del(`drug:${d.serialNumber}`);
            }
        }
        return {
            batchNumber,
            quarantinedCount: drugs.length,
            reason: reason || 'Plant-level quality deviation quarantine initiated by manufacturer',
        };
    }

    async receiveInbound(
        serialNumber: string,
        data: {
            inspectionDisposition: 'ACCEPTED' | 'REJECTED';
            sealVerified: boolean;
            receivingTemp: number;
            notes?: string;
            inspectedBy: string;
            location: string;
            storageZone?: string;
        },
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        drug.inboundInspectionTemp = Number(data.receivingTemp);
        drug.inboundInspectionNotes = data.notes;
        drug.inboundInspectedBy = data.inspectedBy;
        drug.inboundInspectedAt = new Date();

        if (data.inspectionDisposition === 'ACCEPTED' && data.sealVerified) {
            drug.inboundInspectionStatus = 'ACCEPTED_AT_DOCK';
            drug.currentCustodian = 'DHL Healthcare Logistics';
            drug.custodyLocation = data.location || 'DHL Apex Cross-Dock Facility';
            drug.storageZone = data.storageZone || 'ZONE_A_COLD_2_8';
        } else {
            drug.inboundInspectionStatus = 'REJECTED_AT_DOCK';
            drug.qcStatus = 'QUARANTINED';
            drug.isRecalled = true;
            drug.custodyLocation = 'Quarantine Holding Bay - Rejected Inbound';
        }

        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
    }

    async assignFleetVehicle(
        serialNumber: string,
        data: {
            vehicleId: string;
            driverName: string;
            routeDestination: string;
            targetPharmacy?: string;
        },
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        drug.assignedVehicleId = data.vehicleId;
        drug.custodyLocation = `In Transit (${data.vehicleId}) -> ${data.routeDestination}`;
        if (data.targetPharmacy) {
            drug.targetPharmacy = data.targetPharmacy;
        }
        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
    }

    async getFleetOverview() {
        const all = await this.drugRepository.find();
        const van408Serials = all.filter((d) => d.assignedVehicleId === 'VAN-408').map((d) => d.serialNumber);
        const truck112Serials = all.filter((d) => d.assignedVehicleId === 'TRUCK-112').map((d) => d.serialNumber);
        const shuttle07Serials = all.filter((d) => d.assignedVehicleId === 'SHUTTLE-07').map((d) => d.serialNumber);

        return [
            {
                vehicleId: 'VAN-408',
                driverName: 'Marcus Vance',
                model: 'Mercedes-Benz Sprinter Active Reefer',
                route: 'Interstate 95 Express -> Regional Medical Centers',
                status: 'IN_TRANSIT',
                currentLocation: 'Mile Marker 142, Northbound I-95',
                currentTemp: 4.2,
                currentHumidity: 48,
                batteryLevel: 94,
                compressorStatus: 'ACTIVE_OPTIMAL',
                targetTempRange: '2.0°C - 8.0°C',
                assignedBatches: van408Serials,
                hasExcursion: false,
                lastPing: new Date().toISOString(),
            },
            {
                vehicleId: 'TRUCK-112',
                driverName: 'Elena Rostova',
                model: 'Volvo FE Heavy Duty Cold-Chain Freight',
                route: 'Central Packaging Depot -> Airport Crossdock',
                status: 'LOADING_AT_CROSSDOCK',
                currentLocation: 'Apex Logistics Terminal, Gate 12',
                currentTemp: 3.8,
                currentHumidity: 45,
                batteryLevel: 88,
                compressorStatus: 'PRE_COOLING',
                targetTempRange: '2.0°C - 8.0°C',
                assignedBatches: truck112Serials,
                hasExcursion: false,
                lastPing: new Date().toISOString(),
            },
            {
                vehicleId: 'SHUTTLE-07',
                driverName: 'David Kim',
                model: 'Ford E-Transit Electric Cold Van',
                route: 'Downtown Healthcare Corridor -> Hospital District',
                status: 'DELIVERING',
                currentLocation: '7th Avenue Medical Plaza',
                currentTemp: 4.6,
                currentHumidity: 52,
                batteryLevel: 72,
                compressorStatus: 'ACTIVE_OPTIMAL',
                targetTempRange: '2.0°C - 8.0°C',
                assignedBatches: shuttle07Serials,
                hasExcursion: false,
                lastPing: new Date().toISOString(),
            },
        ];
    }

    async createPharmacyManifest(data: {
        manifestId?: string;
        pharmacyName: string;
        pharmacyAddress: string;
        serialNumbers: string[];
        vehicleId: string;
        driverName: string;
        departureSeal: string;
    }) {
        const manifestId = data.manifestId || `MAN-2026-${Date.now().toString().slice(-6)}`;
        const updatedDrugs: Drug[] = [];

        for (const sn of data.serialNumbers) {
            const drug = await this.drugRepository.findOne({ where: { serialNumber: sn } });
            if (drug) {
                drug.targetPharmacy = data.pharmacyName;
                drug.outboundManifestId = manifestId;
                drug.assignedVehicleId = data.vehicleId;
                drug.sealNumber = data.departureSeal;
                drug.custodyLocation = `Dispatched in ${data.vehicleId} -> ${data.pharmacyName}`;
                updatedDrugs.push(drug);
            }
        }

        if (updatedDrugs.length > 0) {
            await this.drugRepository.save(updatedDrugs);
            if (this.redisService) {
                for (const d of updatedDrugs) {
                    await this.redisService.del(`drug:${d.serialNumber}`);
                }
            }
        }

        return {
            manifestId,
            pharmacyName: data.pharmacyName,
            pharmacyAddress: data.pharmacyAddress,
            vehicleId: data.vehicleId,
            driverName: data.driverName,
            departureSeal: data.departureSeal,
            dispatchedSerials: updatedDrugs.map((d) => d.serialNumber),
            dispatchedAt: new Date().toISOString(),
            status: 'OUTBOUND_DISPATCHED',
        };
    }

    async confirmPharmacyDelivery(
        serialNumber: string,
        data: {
            pharmacistName: string;
            pharmacistLicense: string;
            deliveryTemp: number;
            signatureHash?: string;
            notes?: string;
        },
    ) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        drug.currentCustodian = drug.targetPharmacy || 'CVS Central Hospital';
        drug.custodyLocation = `${drug.targetPharmacy || 'Pharmacy'} - Receiving Pharmacy Vault`;
        drug.deliveryProofSignature = data.signatureHash || `SIG-PHARM-${Date.now().toString().slice(-8)}`;
        drug.deliveryProofReceivedBy = `${data.pharmacistName} (License: ${data.pharmacistLicense})`;
        drug.deliveryProofDeliveredAt = new Date();

        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
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
            dosageForm?: string;
            strength?: string;
            expiryDate?: string;
            apiSupplier?: string;
            apiCasNumber?: string;
            rawMaterialLot?: string;
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
        if (updateData.dosageForm !== undefined) {
            drug.dosageForm = updateData.dosageForm;
        }
        if (updateData.strength !== undefined) {
            drug.strength = updateData.strength;
        }
        if (updateData.expiryDate !== undefined) {
            drug.expiryDate = updateData.expiryDate;
        }
        if (updateData.apiSupplier !== undefined) {
            drug.apiSupplier = updateData.apiSupplier;
        }
        if (updateData.apiCasNumber !== undefined) {
            drug.apiCasNumber = updateData.apiCasNumber;
        }
        if (updateData.rawMaterialLot !== undefined) {
            drug.rawMaterialLot = updateData.rawMaterialLot;
        }
        const updated = await this.drugRepository.save(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return updated;
    }

    async deleteDrug(serialNumber: string) {
        const drug = await this.getDrugBySerialNumber(serialNumber);
        await this.drugRepository.remove(drug);
        if (this.redisService) {
            await this.redisService.del(`drug:${serialNumber}`);
        }
        return { deleted: true, serialNumber };
    }

    async getDrugBySerialNumber(serialNumber: string) {
        if (this.redisService) {
            const cached = await this.redisService.get<Drug>(`drug:${serialNumber}`);
            if (cached) {
                return cached;
            }
        }

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

        if (this.redisService) {
            await this.redisService.set(`drug:${serialNumber}`, drug, 120);
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
