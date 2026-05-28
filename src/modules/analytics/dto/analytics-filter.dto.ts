import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum LatencyInterval {
  HOUR = 'hour',
  DAY = 'day',
}

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LatencyFilterDto extends AnalyticsFilterDto {
  @IsOptional()
  @IsEnum(LatencyInterval)
  interval?: LatencyInterval;
}
