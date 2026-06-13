import { z } from 'zod';

const isoDatePreprocess = z.preprocess(
  (val) => (typeof val === 'string' ? new Date(val) : val),
  z.date().optional(),
);

export const reportQuerySchema = z.object({
  startDate: isoDatePreprocess,
  endDate: isoDatePreprocess,
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

export const dashboardTimeframeSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'custom',
]);

export const dashboardQuerySchema = z
  .object({
    timeframe: dashboardTimeframeSchema.optional().default('this_month'),
    startDate: isoDatePreprocess,
    endDate: isoDatePreprocess,
  })
  .superRefine((data, ctx) => {
    if (data.timeframe === 'custom') {
      if (!data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate is required when timeframe is custom',
          path: ['startDate'],
        });
      }
      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate is required when timeframe is custom',
          path: ['endDate'],
        });
      }
    }
  });

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type DashboardTimeframe = z.infer<typeof dashboardTimeframeSchema>;
