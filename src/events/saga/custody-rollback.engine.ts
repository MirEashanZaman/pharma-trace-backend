import { Injectable, BadRequestException } from '@nestjs/common';
import { EventType } from '../event-type.enum';

export interface CompensatingAction {
    failedEventType: EventType;
    compensatingEventType: EventType;
    restoredState: EventType;
    actionDescription: string;
    requiresRegulatorySignoff: boolean;
}

export interface RollbackCompensationReport {
    rollbackId: string;
    serialNumber: string;
    failedEvent: EventType;
    compensatingEvent: EventType;
    restoredCustodyState: EventType;
    rollbackReason: string;
    actionDescription: string;
    initiatedBy: string;
    timestamp: string;
    isCompensated: boolean;
}

@Injectable()
export class CustodyRollbackEngine {
    private readonly compensationMatrix: Partial<Record<EventType, CompensatingAction>> = {
        [EventType.SOLD]: {
            failedEventType: EventType.SOLD,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.DISTRIBUTED,
            actionDescription: 'Compensating Reversal: Void dispensing record and restore package to pharmacy inventory custody.',
            requiresRegulatorySignoff: false,
        },
        [EventType.DISTRIBUTED]: {
            failedEventType: EventType.DISTRIBUTED,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.RECEIVED,
            actionDescription: 'Compensating Reversal: Revert distribution transit and reinstate receiving depot custody.',
            requiresRegulatorySignoff: false,
        },
        [EventType.RECEIVED]: {
            failedEventType: EventType.RECEIVED,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.SHIPPED,
            actionDescription: 'Compensating Reversal: Hold intake inspection failure and return shipment to carrier custody status.',
            requiresRegulatorySignoff: true,
        },
        [EventType.SHIPPED]: {
            failedEventType: EventType.SHIPPED,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.PACKAGED,
            actionDescription: 'Compensating Reversal: Abort carrier handover and revert lot to manufacturer warehouse.',
            requiresRegulatorySignoff: true,
        },
        [EventType.PACKAGED]: {
            failedEventType: EventType.PACKAGED,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.QUALITY_CHECKED,
            actionDescription: 'Compensating Reversal: De-serialize batch packaging and revert to pre-packaging inspection gate.',
            requiresRegulatorySignoff: true,
        },
        [EventType.QUALITY_CHECKED]: {
            failedEventType: EventType.QUALITY_CHECKED,
            compensatingEventType: EventType.QUARANTINED,
            restoredState: EventType.MANUFACTURED,
            actionDescription: 'Compensating Reversal: Reject quality gate and quarantine manufactured lot for re-testing.',
            requiresRegulatorySignoff: true,
        },
    };

    getCompensatingAction(failedEvent: EventType): CompensatingAction {
        const action = this.compensationMatrix[failedEvent];
        if (!action) {
            return {
                failedEventType: failedEvent,
                compensatingEventType: EventType.QUARANTINED,
                restoredState: EventType.QUARANTINED,
                actionDescription: `Emergency Default Rollback: Quarantine batch due to unhandled failure during ${failedEvent}.`,
                requiresRegulatorySignoff: true,
            };
        }
        return action;
    }

    executeRollback(
        serialNumber: string,
        failedEvent: EventType,
        reason: string,
        initiatedBy: string = 'Authorized Enterprise Custodian',
    ): RollbackCompensationReport {
        if (!serialNumber || !serialNumber.trim()) {
            throw new BadRequestException('CustodyRollbackEngine: Drug serial number is required to execute compensation.');
        }

        const plan = this.getCompensatingAction(failedEvent);
        const rollbackId = `ROLLBACK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        return {
            rollbackId,
            serialNumber: serialNumber.trim(),
            failedEvent,
            compensatingEvent: plan.compensatingEventType,
            restoredCustodyState: plan.restoredState,
            rollbackReason: reason || 'Custody transition validation or transaction anchoring failure.',
            actionDescription: plan.actionDescription,
            initiatedBy,
            timestamp: new Date().toISOString(),
            isCompensated: true,
        };
    }
}
