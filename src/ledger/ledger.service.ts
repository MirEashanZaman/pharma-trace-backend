import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LedgerEntryEntity } from './entities/ledger-entry.entity';

export interface LedgerEntry {
    index: number;
    drugSerialNumber: string;
    eventId: number;
    eventHash: string;
    previousHash: string;
    ledgerHash: string;
    timestamp: Date;
}

@Injectable()
export class LedgerService implements OnModuleInit {
    private readonly ledger: LedgerEntry[] = [];

    constructor(
        @InjectRepository(LedgerEntryEntity)
        private readonly ledgerRepo?: Repository<LedgerEntryEntity>,
    ) {}

    async onModuleInit() {
        if (this.ledgerRepo) {
            try {
                const stored = await this.ledgerRepo.find({
                    order: { index: 'ASC' },
                });
                if (stored.length > 0) {
                    this.ledger.length = 0;
                    for (const item of stored) {
                        this.ledger.push({
                            index: item.index,
                            drugSerialNumber: item.drugSerialNumber,
                            eventId: item.eventId,
                            eventHash: item.eventHash,
                            previousHash: item.previousHash,
                            ledgerHash: item.ledgerHash,
                            timestamp: item.timestamp,
                        });
                    }
                }
            } catch {}
        }
    }

    addEvent(
        drugSerialNumber: string,
        eventId: number,
        eventHash: string,
    ): LedgerEntry {
        const previousHash =
            this.ledger.length > 0
                ? this.ledger[this.ledger.length - 1].ledgerHash
                : 'GENESIS';

        const index = this.ledger.length;

        const ledgerHash = createHash('sha256')
            .update(
                JSON.stringify({
                    index,
                    drugSerialNumber,
                    eventId,
                    eventHash,
                    previousHash,
                }),
            )
            .digest('hex');

        const entry: LedgerEntry = {
            index,
            drugSerialNumber,
            eventId,
            eventHash,
            previousHash,
            ledgerHash,
            timestamp: new Date(),
        };

        this.ledger.push(entry);

        if (this.ledgerRepo) {
            this.ledgerRepo
                .save(
                    this.ledgerRepo.create({
                        index,
                        drugSerialNumber,
                        eventId,
                        eventHash,
                        previousHash,
                        ledgerHash,
                        timestamp: entry.timestamp,
                    }),
                )
                .catch(() => {});
        }

        return entry;
    }

    getLedger(): LedgerEntry[] {
        return this.ledger;
    }

    verifyLedger(): boolean {
        for (let i = 0; i < this.ledger.length; i++) {
            const entry = this.ledger[i];

            const expectedPreviousHash =
                i === 0
                    ? 'GENESIS'
                    : this.ledger[i - 1].ledgerHash;

            if (
                entry.previousHash !==
                expectedPreviousHash
            ) {
                return false;
            }

            const expectedHash = createHash('sha256')
                .update(
                    JSON.stringify({
                        index: entry.index,
                        drugSerialNumber:
                            entry.drugSerialNumber,
                        eventId: entry.eventId,
                        eventHash: entry.eventHash,
                        previousHash:
                            entry.previousHash,
                    }),
                )
                .digest('hex');

            if (
                entry.ledgerHash !==
                expectedHash
            ) {
                return false;
            }
        }

        return true;
    }

    tamperEntry(index: number): boolean {
        if (!this.ledger[index]) {
            return false;
        }

        this.ledger[index].eventHash = 'TAMPERED';

        if (this.ledgerRepo) {
            this.ledgerRepo.update({ index }, { eventHash: 'TAMPERED' }).catch(() => {});
        }

        return true;
    }

    getEntryByIndex(index: number): LedgerEntry | undefined {
        return this.ledger[index];
    }

    filterLedger(drugSerialNumber?: string, limit?: number): LedgerEntry[] {
        let entries = this.ledger;
        if (drugSerialNumber) {
            entries = entries.filter((e) => e.drugSerialNumber === drugSerialNumber);
        }
        if (limit) {
            entries = entries.slice(0, Number(limit));
        }
        return entries;
    }

    updateEntryHash(index: number, newHash: string): boolean {
        if (!this.ledger[index]) {
            return false;
        }
        this.ledger[index].eventHash = newHash;
        if (this.ledgerRepo) {
            this.ledgerRepo.update({ index }, { eventHash: newHash }).catch(() => {});
        }
        return true;
    }

    resetLedger(): void {
        this.ledger.length = 0;
        if (this.ledgerRepo) {
            this.ledgerRepo.clear().catch(() => {});
        }
    }
}
