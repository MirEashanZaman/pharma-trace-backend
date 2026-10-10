import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { EventType } from '../event-type.enum';
import { UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class CustodyTransferSaga {
    // Map of lifecycle event types to the authorized supply chain role(s)
    private readonly roleAuthorizations: Record<EventType, UserRole[]> = {
        [EventType.MANUFACTURED]: [UserRole.MANUFACTURER, UserRole.ADMIN],
        [EventType.QUALITY_CHECKED]: [UserRole.MANUFACTURER, UserRole.REGULATOR, UserRole.ADMIN],
        [EventType.PACKAGED]: [UserRole.MANUFACTURER, UserRole.ADMIN],
        [EventType.SHIPPED]: [UserRole.MANUFACTURER, UserRole.DISTRIBUTOR, UserRole.ADMIN],
        [EventType.RECEIVED]: [UserRole.DISTRIBUTOR, UserRole.PHARMACY, UserRole.ADMIN],
        [EventType.DISTRIBUTED]: [UserRole.DISTRIBUTOR, UserRole.ADMIN],
        [EventType.SOLD]: [UserRole.PHARMACY, UserRole.ADMIN],
        [EventType.TEMPERATURE_MONITORED]: [
            UserRole.MANUFACTURER,
            UserRole.DISTRIBUTOR,
            UserRole.PHARMACY,
            UserRole.REGULATOR,
            UserRole.ADMIN,
        ],
    };

    validateTransition(
        previousEvent: EventType | null,
        nextEvent: EventType,
        userRole?: UserRole | string,
    ): void {
        // 1. RBAC Verification
        if (userRole) {
            const normalizedRole = userRole as UserRole;
            const allowedRoles = this.roleAuthorizations[nextEvent] || [];

            if (
                normalizedRole !== UserRole.ADMIN &&
                allowedRoles.length > 0 &&
                !allowedRoles.includes(normalizedRole)
            ) {
                throw new ForbiddenException(
                    `Role '${normalizedRole}' is not authorized to execute '${nextEvent}' transition. Allowed roles: [${allowedRoles.join(
                        ', ',
                    )}]`,
                );
            }
        }

        // 2. Telemetry and Genesis bypass
        if (
            nextEvent === EventType.TEMPERATURE_MONITORED ||
            previousEvent === EventType.TEMPERATURE_MONITORED
        ) {
            return;
        }

        if (previousEvent === null) {
            return;
        }

        // 3. State Machine Transition Verification
        const allowedTransitions: Partial<
            Record<EventType, EventType[]>
        > = {
            [EventType.MANUFACTURED]: [
                EventType.QUALITY_CHECKED,
                EventType.PACKAGED,
            ],

            [EventType.QUALITY_CHECKED]: [
                EventType.PACKAGED,
            ],

            [EventType.PACKAGED]: [
                EventType.SHIPPED,
            ],

            [EventType.SHIPPED]: [
                EventType.RECEIVED,
            ],

            [EventType.RECEIVED]: [
                EventType.DISTRIBUTED,
            ],

            [EventType.DISTRIBUTED]: [
                EventType.SOLD,
            ],
        };

        const allowed =
            allowedTransitions[previousEvent] ?? [];

        if (!allowed.includes(nextEvent)) {
            throw new BadRequestException(
                `Invalid custody transition: ${previousEvent} → ${nextEvent}`,
            );
        }
    }
}