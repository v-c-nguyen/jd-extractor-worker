export type PeriodPerformance = {
  bidCount: number;
  interviewCount: number;
  interviewRatePct: number | null;
};

/** Current period minus the comparison period (e.g. today − yesterday). Positive = higher now. */
export type PeriodComparisonDelta = {
  interviewDelta: number;
  bidDelta: number;
  /** Interview rate change in percentage points; null if not comparable (e.g. zero bids in either period). */
  rateDeltaPctPoints: number | null;
};

export type BidderPerformanceRow = {
  bidderId: string;
  name: string;
  today: PeriodPerformance;
  week: PeriodPerformance;
  month: PeriodPerformance;
  vsYesterday: PeriodComparisonDelta;
  vsLastWeek: PeriodComparisonDelta;
  vsLastMonth: PeriodComparisonDelta;
};

export type WeeklyTeamRatePoint = {
  weekStart: string;
  weekEnd: string;
  bidCount: number;
  interviewCount: number;
  interviewRatePct: number | null;
};
