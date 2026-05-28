import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsFilterDto,
  LatencyFilterDto,
} from './dto/analytics-filter.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getOverview(userId, filter);
  }

  @Get('providers')
  getProviders(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getProviderBreakdown(userId, filter);
  }

  @Get('models')
  getModels(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getModelBreakdown(userId, filter);
  }

  @Get('latency')
  getLatency(
    @CurrentUser('id') userId: number,
    @Query() filter: LatencyFilterDto,
  ) {
    return this.analyticsService.getLatencyTrend(userId, filter);
  }

  @Get('errors')
  getErrors(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getErrors(userId, filter);
  }
}
