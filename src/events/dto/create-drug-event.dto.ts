import { IsEnum, IsObject, IsString, Length } from 'class-validator';
import { EventType } from '../event-type.enum';

export class CreateDrugEventDto {
    @IsString()
    @Length(1, 100)
    drugSerialNumber!: string;

    @IsEnum(EventType)
    eventType!: EventType;

    @IsObject()
    eventData!: Record<string, any>;
}