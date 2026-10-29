jest.mock('@nestjs/jwt', () => ({
    JwtService: class MockJwtService {
        sign() {
            return 'mock-jwt-token';
        }
    },
}));

import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';

describe('AuthService - Admin Moderation Safeguards', () => {
    let service: AuthService;

    const mockAdminUser: User = {
        id: 1,
        email: 'admin@pharma.com',
        role: UserRole.ADMIN,
        fullName: 'Lead Administrator',
        isDisabled: false,
        warningCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockOtherAdminUser: User = {
        id: 2,
        email: 'sec-admin@pharma.com',
        role: UserRole.ADMIN,
        fullName: 'Security Administrator',
        isDisabled: false,
        warningCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockStandardUser: User = {
        id: 3,
        email: 'distributor@pharma.com',
        role: UserRole.DISTRIBUTOR,
        fullName: 'Logistics Partner',
        isDisabled: false,
        warningCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    let userStore: Map<number, User>;

    const mockUserRepository = {
        findOne: jest.fn(({ where }: { where: { id?: number; email?: string } }) => {
            if (where.id) {
                return Promise.resolve(userStore.get(where.id) || null);
            }
            if (where.email) {
                for (const u of userStore.values()) {
                    if (u.email === where.email) return Promise.resolve(u);
                }
            }
            return Promise.resolve(null);
        }),
        save: jest.fn((user: User) => {
            userStore.set(user.id, { ...user });
            return Promise.resolve(user);
        }),
        remove: jest.fn((user: User) => {
            userStore.delete(user.id);
            return Promise.resolve(user);
        }),
        query: jest.fn().mockResolvedValue([]),
    };

    const mockJwtService = {
        sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockBlockchainService = {
        verifyWalletSignature: jest.fn().mockReturnValue(true),
    };

    const mockMailService = {
        sendPasswordResetOtp: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
        userStore = new Map<number, User>([
            [1, { ...mockAdminUser }],
            [2, { ...mockOtherAdminUser }],
            [3, { ...mockStandardUser }],
        ]);

        service = new AuthService(
            mockUserRepository as any,
            mockJwtService as any,
            mockBlockchainService as any,
            mockMailService as any,
        );
    });

    describe('Admin Warning Restrictions', () => {
        it('should prevent an admin from giving another admin a warning', async () => {
            await expect(
                service.warnUser(2, 'Test violation reason', 1)
            ).rejects.toThrow(ForbiddenException);
        });

        it('should prevent an admin from issuing a warning to their own account', async () => {
            await expect(
                service.warnUser(1, 'Self warning', 1)
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow an admin to issue a warning to a standard participant', async () => {
            const updated = await service.warnUser(3, 'Temperature spike during transport', 1);
            expect(updated.warningCount).toBe(1);
            expect(updated.warningReason).toBe('Temperature spike during transport');
            expect(updated.warningIssuedAt).toBeDefined();
        });
    });

    describe('Admin Account Disabling Restrictions', () => {
        it('should prevent an admin from disabling another admin account', async () => {
            await expect(
                service.setDisabledStatus(2, true, 1, 'Policy infraction')
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow an admin to disable and re-enable a standard participant', async () => {
            const disabled = await service.setDisabledStatus(3, true, 1, 'Audit hold');
            expect(disabled.isDisabled).toBe(true);

            const reEnabled = await service.setDisabledStatus(3, false, 1);
            expect(reEnabled.isDisabled).toBe(false);
        });
    });

    describe('Admin Account Deletion Restrictions', () => {
        it('should prevent an admin from deleting another admin account', async () => {
            await expect(
                service.deleteUser(2, 1)
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow an admin to delete a standard participant', async () => {
            const result = await service.deleteUser(3, 1);
            expect(result.deleted).toBe(true);
            expect(result.id).toBe(3);
        });
    });
});
