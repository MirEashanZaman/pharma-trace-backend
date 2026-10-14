import { CustodyTransferSaga } from './custody-transfer.saga';
import { EventType } from '../event-type.enum';
import { UserRole } from '../../auth/entities/user.entity';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('CustodyTransferSaga RBAC & Lifecycle Transitions', () => {
    let saga: CustodyTransferSaga;

    beforeEach(() => {
        saga = new CustodyTransferSaga();
    });

    it('should allow valid lifecycle transition with authorized role', () => {
        expect(() =>
            saga.validateTransition(
                EventType.MANUFACTURED,
                EventType.QUALITY_CHECKED,
                UserRole.MANUFACTURER
            )
        ).not.toThrow();
    });

    it('should reject lifecycle transition if user role is unauthorized (e.g. PHARMACY creating MANUFACTURED)', () => {
        expect(() =>
            saga.validateTransition(
                null,
                EventType.MANUFACTURED,
                UserRole.PHARMACY
            )
        ).toThrow(ForbiddenException);
    });

    it('should allow ADMIN to perform any transition', () => {
        expect(() =>
            saga.validateTransition(
                EventType.SHIPPED,
                EventType.RECEIVED,
                UserRole.ADMIN
            )
        ).not.toThrow();
    });

    it('should reject invalid lifecycle sequence even if role is valid for next event (e.g. MANUFACTURED -> DISTRIBUTED by DISTRIBUTOR)', () => {
        expect(() =>
            saga.validateTransition(
                EventType.MANUFACTURED,
                EventType.DISTRIBUTED,
                UserRole.DISTRIBUTOR
            )
        ).toThrow(BadRequestException);
    });

    it('should require dual doctor and pharmacist multi-signatures for SOLD event', () => {
        expect(() =>
            saga.validateMultiSignatureDispensing(undefined)
        ).toThrow(BadRequestException);

        expect(() =>
            saga.validateMultiSignatureDispensing({ doctorSignature: '0xabc' })
        ).toThrow(BadRequestException);

        expect(() =>
            saga.validateMultiSignatureDispensing({
                doctorSignature: '0xabc123',
                pharmacistSignature: '0xdef456',
            })
        ).not.toThrow();
    });

    it('should allow REGULATOR to issue emergency RECALLED at any stage', () => {
        expect(() =>
            saga.validateTransition(
                EventType.SHIPPED,
                EventType.RECALLED,
                UserRole.REGULATOR
            )
        ).not.toThrow();
    });

    it('should reject emergency RECALLED if attempted by unauthorized role (e.g. CUSTOMER or DISTRIBUTOR)', () => {
        expect(() =>
            saga.validateTransition(
                EventType.SHIPPED,
                EventType.RECALLED,
                UserRole.DISTRIBUTOR
            )
        ).toThrow(ForbiddenException);
    });

    it('should enforce circuit breaker: block any further custody transfers once a batch is RECALLED', () => {
        expect(() =>
            saga.validateTransition(
                EventType.RECALLED,
                EventType.SOLD,
                UserRole.PHARMACY
            )
        ).toThrow(ForbiddenException);

        expect(() =>
            saga.validateTransition(
                EventType.RECALLED,
                EventType.SHIPPED,
                UserRole.ADMIN
            )
        ).toThrow(ForbiddenException);
    });
});
