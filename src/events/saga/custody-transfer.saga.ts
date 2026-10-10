import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import { EventType } from '../event-type.enum';

@Injectable()
export class CustodyTransferSaga {

    validateTransition(
        previousEvent: EventType | null,
        nextEvent: EventType,
    ): void {

        if (
            nextEvent === EventType.TEMPERATURE_MONITORED ||
            previousEvent === EventType.TEMPERATURE_MONITORED
        ) {
            return;
        }

        if (previousEvent === null) {
            return;
        }

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