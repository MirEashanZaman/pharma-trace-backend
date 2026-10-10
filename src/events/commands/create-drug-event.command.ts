import { CreateDrugEventDto } from '../dto/create-drug-event.dto';

export class CreateDrugEventCommand {
    constructor(
        public readonly data: CreateDrugEventDto,
    ) { }
}