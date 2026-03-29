export type PeriodPerformance = {
  bidCount: number;
  interviewCount: number;
  interviewRatePct: number | null;
};

export type BidderPerformanceRow = {
  bidderId: string;
  name: string;
  today: PeriodPerformance;
  week: PeriodPerformance;
  month: PeriodPerformance;
};

export type WeeklyTeamRatePoint = {
  weekStart: string;
  weekEnd: string;
  bidCount: number;
  interviewCount: number;
  interviewRatePct: number | null;
};
