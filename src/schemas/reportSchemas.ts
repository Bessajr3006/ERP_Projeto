import { z } from 'zod';

export const DashboardStatsSchema = z.object({
    total_balance: z.number(),
    total_products: z.number(),
    total_customers: z.number(),
    sales_today_count: z.number(),
    sales_today_amount: z.number(),
    total_payables: z.number().default(0),
    total_receivables: z.number().default(0),
    low_stock: z.array(
        z.object({
            name: z.string(),
            current_stock: z.number(),
            measure: z.string().nullable().optional()
        }).passthrough()
    ),
    chart: z.object({
        labels: z.array(z.string()),
        income: z.array(z.number()),
        expense: z.array(z.number())
    })
});
