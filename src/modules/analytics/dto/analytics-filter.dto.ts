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

class BaseDateFilterDto {
  @ApiPropertyOptional({
    example: '2025-01-01',
    description: 'Start of date range (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'End of date range (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AnalyticsFilterDto extends BaseDateFilterDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by registered provider ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter by provider model ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerModelId?: number;
}

export class LatencyFilterDto extends AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: LatencyInterval,
    default: LatencyInterval.DAY,
    description: 'Time bucket granularity — hour or day (default: day)',
  })
  @IsOptional()
  @IsEnum(LatencyInterval)
  interval?: LatencyInterval;
}

// Comparison does not accept providerModelId — filtering to a single model
// leaves nothing to compare. providerId is valid only for comparisonType=model
// to scope the comparison to models within a specific provider.
export class ComparisonFilterDto extends BaseDateFilterDto {
  @ApiPropertyOptional({
    enum: ComparisonType,
    default: ComparisonType.PROVIDER,
    description:
      'provider → compare providers; model → compare models within a provider.',
  })
  @IsOptional()
  @IsEnum(ComparisonType)
  comparisonType?: ComparisonType;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Scope model comparison to a single provider (only applies when comparisonType=model)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerId?: number;
}
