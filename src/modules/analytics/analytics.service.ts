import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { InferenceLog } from '../../entities/inference.logs.entity';
import {
  AnalyticsFilterDto,
  ComparisonFilterDto,
  ComparisonType,
  LatencyFilterDto,
  LatencyInterval,
} from './dto/analytics-filter.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(InferenceLog)
    private readonly inferenceLogRepo: Repository<InferenceLog>,
  ) {}

  // ── base query ──────────────────────────────────────────────────────────────

  private baseQuery(userId: number): SelectQueryBuilder<InferenceLog> {
    return this.inferenceLogRepo
      .createQueryBuilder('il')
      .innerJoin('il.chat', 'chat')
      .where('chat.userId = :userId', { userId });
  }

  // ── filter application ───────────────────────────────────────────────────────

  private applyFilters(
    qb: SelectQueryBuilder<InferenceLog>,
    filter: {
      providerId?: number;
      providerModelId?: number;
      from?: string;
      to?: string;
    },
  ): SelectQueryBuilder<InferenceLog> {
    if (filter.providerId) {
      qb.andWhere('il.providerId = :providerId', {
        providerId: filter.providerId,
      });
    }
    if (filter.providerModelId) {
      qb.andWhere('il.providerModelId = :providerModelId', {
        providerModelId: filter.providerModelId,
      });
    }
    if (filter.from) {
      qb.andWhere('il.createdOn >= :from', { from: new Date(filter.from) });
    }
    if (filter.to) {
      qb.andWhere('il.createdOn <= :to', { to: new Date(filter.to) });
    }
    return qb;
  }

  // ── shared aggregation selects ───────────────────────────────────────────────

  // .select() on the first call clears the default entity-column projection so
  // PostgreSQL does not complain about ungrouped columns alongside aggregates.
  private addAggregates(
    qb: SelectQueryBuilder<InferenceLog>,
  ): SelectQueryBuilder<InferenceLog> {
    return qb
      .select('COUNT(*)', 'totalRequests')
      .addSelect(
        "SUM(CASE WHEN il.status = 'success' THEN 1 ELSE 0 END)",
        'successfulRequests',
      )
      .addSelect(
        "SUM(CASE WHEN il.status = 'error' THEN 1 ELSE 0 END)",
        'failedRequests',
      )
      .addSelect('AVG(il.latency_ms)', 'averageLatencyMs')
      .addSelect('SUM(il.total_tokens)', 'totalTokens');
  }

  private parseAggregates(r: Record<string, string>) {
    return {
      totalRequests: parseInt(r.totalRequests) || 0,
      successfulRequests: parseInt(r.successfulRequests) || 0,
      failedRequests: parseInt(r.failedRequests) || 0,
      averageLatencyMs: parseFloat(r.averageLatencyMs) || 0,
      totalTokens: parseInt(r.totalTokens) || 0,
    };
  }

  // ── 1. Overview dashboard ────────────────────────────────────────────────────

  async getOverview(userId: number, filter: AnalyticsFilterDto) {
    this.logger.log(`getOverview — user ${userId}`);

    const raw = await this.addAggregates(
      this.applyFilters(this.baseQuery(userId), filter),
    )
      .addSelect('SUM(il.input_tokens)', 'totalInputTokens')
      .addSelect('SUM(il.output_tokens)', 'totalOutputTokens')
      .getRawOne<Record<string, string>>();

    return {
      totalRequests: parseInt(raw?.totalRequests ?? '0') || 0,
      successfulRequests: parseInt(raw?.successfulRequests ?? '0') || 0,
      failedRequests: parseInt(raw?.failedRequests ?? '0') || 0,
      averageLatencyMs: parseFloat(raw?.averageLatencyMs ?? '0') || 0,
      totalInputTokens: parseInt(raw?.totalInputTokens ?? '0') || 0,
      totalOutputTokens: parseInt(raw?.totalOutputTokens ?? '0') || 0,
      totalTokens: parseInt(raw?.totalTokens ?? '0') || 0,
    };
  }

  // ── 2. Comparison dashboard ──────────────────────────────────────────────────
  // comparisonType=provider  → group by provider
  // comparisonType=model     → group by provider + model

  async getComparison(userId: number, filter: ComparisonFilterDto) {
    this.logger.log(
      `getComparison — user ${userId}, type ${filter.comparisonType ?? ComparisonType.PROVIDER}`,
    );
    const type = filter.comparisonType ?? ComparisonType.PROVIDER;
    const qb = this.applyFilters(this.baseQuery(userId), filter);

    if (type === ComparisonType.PROVIDER) {
      const rows = await this.addAggregates(qb)
        .addSelect('il.provider', 'provider')
        .groupBy('il.provider')
        .orderBy('"totalRequests"', 'DESC')
        .getRawMany<Record<string, string>>();

      return rows.map((r) => ({
        provider: r.provider,
        ...this.parseAggregates(r),
      }));
    }

    // model comparison — group by provider + model
    const rows = await this.addAggregates(qb)
      .addSelect('il.provider', 'provider')
      .addSelect('il.model', 'model')
      .groupBy('il.provider')
      .addGroupBy('il.model')
      .orderBy('"totalRequests"', 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      provider: r.provider,
      model: r.model,
      ...this.parseAggregates(r),
    }));
  }

  // ── 3. Latency trend dashboard ───────────────────────────────────────────────

  async getLatencyTrend(userId: number, filter: LatencyFilterDto) {
    this.logger.log(`getLatencyTrend — user ${userId}`);
    const interval = filter.interval ?? LatencyInterval.DAY;

    const rows = await this.applyFilters(this.baseQuery(userId), filter)
      .select(`DATE_TRUNC('${interval}', il.created_on)`, 'bucket')
      .addSelect('AVG(il.latency_ms)', 'averageLatencyMs')
      .addSelect('COUNT(*)', 'totalRequests')
      .groupBy(`DATE_TRUNC('${interval}', il.created_on)`)
      .orderBy(`DATE_TRUNC('${interval}', il.created_on)`, 'ASC')
      .getRawMany<{
        bucket: string;
        averageLatencyMs: string;
        totalRequests: string;
      }>();

    return rows.map((r) => ({
      bucket: r.bucket,
      averageLatencyMs: parseFloat(r.averageLatencyMs) || 0,
      totalRequests: parseInt(r.totalRequests) || 0,
    }));
  }

  // ── 4. Throughput dashboard ──────────────────────────────────────────────────

  async getThroughput(userId: number, filter: LatencyFilterDto) {
    this.logger.log(`getThroughput — user ${userId}`);
    const interval = filter.interval ?? LatencyInterval.DAY;

    const rows = await this.applyFilters(this.baseQuery(userId), filter)
      .select(`DATE_TRUNC('${interval}', il.created_on)`, 'bucket')
      .addSelect('COUNT(*)', 'totalRequests')
      .addSelect(
        "SUM(CASE WHEN il.status = 'success' THEN 1 ELSE 0 END)",
        'successfulRequests',
      )
      .addSelect(
        "SUM(CASE WHEN il.status = 'error' THEN 1 ELSE 0 END)",
        'failedRequests',
      )
      .groupBy(`DATE_TRUNC('${interval}', il.created_on)`)
      .orderBy(`DATE_TRUNC('${interval}', il.created_on)`, 'ASC')
      .getRawMany<{
        bucket: string;
        totalRequests: string;
        successfulRequests: string;
        failedRequests: string;
      }>();

    return rows.map((r) => ({
      bucket: r.bucket,
      totalRequests: parseInt(r.totalRequests) || 0,
      successfulRequests: parseInt(r.successfulRequests) || 0,
      failedRequests: parseInt(r.failedRequests) || 0,
    }));
  }

  // ── 5. Error dashboard ───────────────────────────────────────────────────────

  async getErrors(userId: number, filter: AnalyticsFilterDto) {
    this.logger.log(`getErrors — user ${userId}`);
    const errorBase = () =>
      this.applyFilters(this.baseQuery(userId), filter).andWhere(
        "il.status = 'error'",
      );

    const [totalRaw, byProviderRows, recentRows] = await Promise.all([
      errorBase().select('COUNT(*)', 'total').getRawOne<{ total: string }>(),

      errorBase()
        .select('il.provider', 'provider')
        .addSelect('COUNT(*)', 'count')
        .groupBy('il.provider')
        .orderBy('"count"', 'DESC')
        .getRawMany<{ provider: string; count: string }>(),

      errorBase()
        .select('il.provider', 'provider')
        .addSelect('il.model', 'model')
        .addSelect('il.errorMessage', 'errorMessage')
        .addSelect('il.createdOn', 'createdOn')
        .orderBy('il.createdOn', 'DESC')
        .limit(20)
        .getRawMany<{
          provider: string;
          model: string;
          errorMessage: string | null;
          createdOn: Date;
        }>(),
    ]);

    return {
      totalErrors: parseInt(totalRaw?.total ?? '0') || 0,
      errorsByProvider: byProviderRows.map((r) => ({
        provider: r.provider,
        count: parseInt(r.count) || 0,
      })),
      recentErrors: recentRows.map((r) => ({
        provider: r.provider,
        model: r.model,
        errorMessage: r.errorMessage,
        createdOn: r.createdOn,
      })),
    };
  }
}
