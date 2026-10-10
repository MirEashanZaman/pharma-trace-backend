import { Test, TestingModule } from '@nestjs/testing';
import { DrugsService } from './drugs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Drug } from './entities/drug.entity';

describe('DrugsService', () => {
  let service: DrugsService;

  const mockDrugRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugsService,
        {
          provide: getRepositoryToken(Drug),
          useValue: mockDrugRepository,
        },
      ],
    }).compile();

    service = module.get<DrugsService>(DrugsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
