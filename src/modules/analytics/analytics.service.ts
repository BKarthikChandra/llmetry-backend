import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { InferenceLog } from '../../entities/inference.logs.entity';
import {
  AnalyticsFilterDto,
  LatencyFilterDto,
  LatencyInterval,
} from './dto/analytics-filter.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(InferenceLog)
    private readonly inferenceLogRepo: Repository<InferenceLog>,
  ) {}

  private baseQuery(userId: number): SelectQueryBuilder<InferenceLog> {
    return this.inferenceLogRepo
      .createQueryBuilder('il')
      .innerJoin('il.chat', 'chat')
      .where('chat.userId = :userId', { userId });
  }

  private applyFilters(
    qb: SelectQueryBuilder<InferenceLog>,
    filter: AnalyticsFilterDto,
  ): SelectQueryBuilder<InferenceLog> {
    if (filter.provider) {
      qb.andWhere('il.provider = :provider', { provider: filter.provider });
    }
    if (filter.model) {
      qb.andWhere('il.model = :model', { model: filter.model });
    }
    if (filter.from) {
      qb.andWhere('il.createdAt >= :from', { from: new Date(filter.from) });
    }
    if (filter.to) {
      qb.andWhere('il.createdAt <= :to', { to: new Date(filter.to) });
    }
    return qb;
  }

  async getOverview(userId: number, filter: AnalyticsFilterDto) {
    const raw = await this.applyFilters(this.baseQuery(userId), filter)
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
      .addSelect('SUM(il.input_tokens)', 'totalInputTokens')
      .addSelect('SUM(il.output_tokens)', 'totalOutputTokens')
      .addSelect('SUM(il.total_tokens)', 'totalTokens')
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

  async getProviderBreakdown(userId: number, filter: AnalyticsFilterDto) {
    const rows = await this.applyFilters(this.baseQuery(userId), filter)
      .select('il.provider', 'provider')
      .addSelect('COUNT(*)', 'totalRequests')
      .addSelect(
        "SUM(CASE WHEN il.status = 'success' THEN 1 ELSE 0 END)",
        'successfulRequests',
      )
      .addSelect(
        "SUM(CASE WHEN il.status = 'error' THEN 1 ELSE 0 END)",
        'failedRequests',
      )
      .addSelect('AVG(il.latency_ms)', 'averageLatencyMs')
      .addSelect('SUM(il.total_tokens)', 'totalTokens')
      .groupBy('il.provider')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      provider: r.provider,
      totalRequests: parseInt(r.totalRequests) || 0,
      successfulRequests: parseInt(r.successfulRequests) || 0,
      failedRequests: parseInt(r.failedRequests) || 0,
      averageLatencyMs: parseFloat(r.averageLatencyMs) || 0,
      totalTokens: parseInt(r.totalTokens) || 0,
    }));
  }

  async getModelBreakdown(userId: number, filter: AnalyticsFilterDto) {
    const rows = await this.applyFilters(this.baseQuery(userId), filter)
      .select('il.provider', 'provider')
      .addSelect('il.model', 'model')
      .addSelect('COUNT(*)', 'totalRequests')
      .addSelect(
        "SUM(CASE WHEN il.status = 'success' THEN 1 ELSE 0 END)",
        'successfulRequests',
      )
      .addSelect(
        "SUM(CASE WHEN il.status = 'error' THEN 1 ELSE 0 END)",
        'failedRequests',
      )
      .addSelect('AVG(il.latency_ms)', 'averageLatencyMs')
      .addSelect('SUM(il.total_tokens)', 'totalTokens')
      .groupBy('il.provider')
      .addGroupBy('il.model')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalRequests: parseInt(r.totalRequests) || 0,
      successfulRequests: parseInt(r.successfulRequests) || 0,
      failedRequests: parseInt(r.failedRequests) || 0,
      averageLatencyMs: parseFloat(r.averageLatencyMs) || 0,
      totalTokens: parseInt(r.totalTokens) || 0,
    }));
  }

  async getLatencyTrend(userId: number, filter: LatencyFilterDto) {
    const interval = filter.interval ?? LatencyInterval.DAY;

    const rows = await this.applyFilters(this.baseQuery(userId), filter)
      .select(`DATE_TRUNC('${interval}', il.created_at)`, 'bucket')
      .addSelect('AVG(il.latency_ms)', 'averageLatencyMs')
      .addSelect('COUNT(*)', 'totalRequests')
      .groupBy(`DATE_TRUNC('${interval}', il.created_at)`)
      .orderBy(`DATE_TRUNC('${interval}', il.created_at)`, 'ASC')
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

  async getErrors(userId: number, filter: AnalyticsFilterDto) {
    const errorBase = () =>
      this.applyFilters(this.baseQuery(userId), filter).andWhere(
        "il.status = 'error'",
      );

    const [totalRaw, byProviderRows, recentRows] = await Promise.all([
      errorBase()
        .select('COUNT(*)', 'total')
        .getRawOne<{ total: string }>(),

      errorBase()
        .select('il.provider', 'provider')
        .addSelect('COUNT(*)', 'count')
        .groupBy('il.provider')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany<{ provider: string; count: string }>(),

      errorBase()
        .select('il.provider', 'provider')
        .addSelect('il.model', 'model')
        .addSelect('il.errorMessage', 'errorMessage')
        .addSelect('il.createdAt', 'createdAt')
        .orderBy('il.createdAt', 'DESC')
        .limit(20)
        .getRawMany<{
          provider: string;
          model: string;
          errorMessage: string | null;
          createdAt: Date;
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
        createdAt: r.createdAt,
      })),
    };
  }
}
