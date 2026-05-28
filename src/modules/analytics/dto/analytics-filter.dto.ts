import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum LatencyInterval {
  HOUR = 'hour',
  DAY = 'day',
}

export enum ComparisonType {
  PROVIDER = 'provider',
  MODEL = 'model',
}

export class AnalyticsFilterDto {
  @ApiPropertyOptional({ example: 1, description: 'Filter by registered provider ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by provider model ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerModelId?: number;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Start of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LatencyFilterDto extends AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: LatencyInterval,
    default: LatencyInterval.DAY,
    description: 'Time bucket granularity for the latency trend',
  })
  @IsOptional()
  @IsEnum(LatencyInterval)
  interval?: LatencyInterval;
}

export class ComparisonFilterDto extends AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: ComparisonType,
    default: ComparisonType.PROVIDER,
    description:
      'provider → group by provider; model → group by provider + model. ' +
      'When comparisonType=model, providerId may be used to scope to a single provider.',
  })
  @IsOptional()
  @IsEnum(ComparisonType)
  comparisonType?: ComparisonType;
}
