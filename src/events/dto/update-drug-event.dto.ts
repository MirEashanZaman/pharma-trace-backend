import {
    IsEnum,
    IsObject,
    IsOptional,
    IsString,
    Length,
} from 'class-validator';
import { EventType } from '../event-type.enum';

export class UpdateDrugEventDto {
    @IsOptional()
    @IsString()
    @Length(1, 100)
    drugSerialNumber?: string;

    @IsOptional()
    @IsEnum(EventType)
    eventType?: EventType;

    @IsOptional()
    @IsObject()
    eventData?: Record<string, any>;
}