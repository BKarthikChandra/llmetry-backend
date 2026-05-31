import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InferenceLog } from '../../entities/inference.logs.entity';
import { AnalyticsService } from './analytics.service';
import { LatencyInterval } from './dto/analytics-filter.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let queryBuilder: {
    createQueryBuilder?: jest.Mock;
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    setParameter: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(InferenceLog),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses the requested timezone for date filters and buckets', async () => {
    await service.getThroughput(7, {
      from: '2025-01-01',
      to: '2025-01-31',
      timezone: 'Asia/Kolkata',
      interval: LatencyInterval.DAY,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(il.created_on AT TIME ZONE 'UTC' AT TIME ZONE :timezone) >= CAST(:from AS timestamp)",
      { from: '2025-01-01', timezone: 'Asia/Kolkata' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(il.created_on AT TIME ZONE 'UTC' AT TIME ZONE :timezone) <= CAST(:to AS timestamp)",
      { to: '2025-01-31', timezone: 'Asia/Kolkata' },
    );
    expect(queryBuilder.select).toHaveBeenCalledWith(
      "DATE_TRUNC('day', (il.created_on AT TIME ZONE 'UTC' AT TIME ZONE :timezone))",
      'bucket',
    );
    expect(queryBuilder.setParameter).toHaveBeenCalledWith(
      'timezone',
      'Asia/Kolkata',
    );
  });
});
