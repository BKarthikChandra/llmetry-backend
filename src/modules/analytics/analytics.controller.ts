import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsFilterDto,
  ComparisonFilterDto,
  ComparisonType,
  LatencyFilterDto,
  LatencyInterval,
} from './dto/analytics-filter.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── 1. Overview ──────────────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({
    summary: 'Combined overview dashboard',
    description:
      'Aggregated request counts, average latency, and token usage across all providers and ' +
      'models for the authenticated user. All filters are optional and can be combined.',
  })
  @ApiQuery({ name: 'providerId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'providerModelId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Overview statistics',
    schema: {
      example: {
        totalRequests: 340,
        successfulRequests: 320,
        failedRequests: 20,
        averageLatencyMs: 812.5,
        totalInputTokens: 48200,
        totalOutputTokens: 31600,
        totalTokens: 79800,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getOverview(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getOverview(userId, filter);
  }

  // ── 2. Comparison ────────────────────────────────────────────────────────────

  @Get('comparison')
  @ApiOperation({
    summary: 'Provider or model comparison dashboard',
    description:
      'comparisonType=provider groups results by provider (Gemini vs OpenAI vs Claude). ' +
      'comparisonType=model groups by provider + model and supports an optional providerId ' +
      'to scope the comparison to a single provider.',
  })
  @ApiQuery({
    name: 'comparisonType',
    required: false,
    enum: ComparisonType,
    example: ComparisonType.PROVIDER,
  })
  @ApiQuery({ name: 'providerId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'providerModelId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Per-provider or per-model comparison',
    schema: {
      example: [
        {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          totalRequests: 150,
          successfulRequests: 145,
          failedRequests: 5,
          averageLatencyMs: 680.3,
          totalTokens: 38000,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getComparison(
    @CurrentUser('id') userId: number,
    @Query() filter: ComparisonFilterDto,
  ) {
    return this.analyticsService.getComparison(userId, filter);
  }

  // ── 3. Latency trend ─────────────────────────────────────────────────────────

  @Get('latency')
  @ApiOperation({
    summary: 'Latency trend dashboard',
    description:
      'Average latency and request count bucketed by hour or day using PostgreSQL DATE_TRUNC. ' +
      'Defaults to daily buckets when interval is omitted.',
  })
  @ApiQuery({ name: 'providerId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'providerModelId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-12-31' })
  @ApiQuery({
    name: 'interval',
    required: false,
    enum: LatencyInterval,
    example: LatencyInterval.DAY,
    description: 'Bucketing granularity — hour or day (default: day)',
  })
  @ApiResponse({
    status: 200,
    description: 'Time-bucketed latency trend',
    schema: {
      example: [
        { bucket: '2025-05-01T00:00:00.000Z', averageLatencyMs: 790.4, totalRequests: 42 },
        { bucket: '2025-05-02T00:00:00.000Z', averageLatencyMs: 831.1, totalRequests: 38 },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLatency(
    @CurrentUser('id') userId: number,
    @Query() filter: LatencyFilterDto,
  ) {
    return this.analyticsService.getLatencyTrend(userId, filter);
  }

  // ── 4. Error dashboard ───────────────────────────────────────────────────────

  @Get('errors')
  @ApiOperation({
    summary: 'Error analytics dashboard',
    description:
      'Total error count, errors grouped by provider, and the 20 most recent error logs ' +
      'for the authenticated user. Only inference logs with status = "error" are included.',
  })
  @ApiQuery({ name: 'providerId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'providerModelId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Error analytics',
    schema: {
      example: {
        totalErrors: 20,
        errorsByProvider: [{ provider: 'gemini', count: 20 }],
        recentErrors: [
          {
            provider: 'gemini',
            model: 'gemini-2.0-flash',
            errorMessage: 'API quota exceeded',
            createdAt: '2025-05-27T14:32:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getErrors(
    @CurrentUser('id') userId: number,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getErrors(userId, filter);
  }
}
