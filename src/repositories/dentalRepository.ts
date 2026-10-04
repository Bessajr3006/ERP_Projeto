import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { DentalChart, DentalChartTooth, DentalProcedure } from '../types/Dental';

type DBClient = Pool | PoolConnection;

export class DentalRepository {
    static async getChartByCustomerId(client: DBClient, companyId: number, customerId: number): Promise<DentalChart | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dc.*, c.public_id AS customer_public_id, c.name AS customer_name
             FROM dental_charts dc
             JOIN customers c ON dc.customer_id = c.id
             WHERE dc.company_id = ? AND dc.customer_id = ? AND dc.is_deleted = 0
             LIMIT 1`,
            [companyId, customerId]
        );

        if (!rows || rows.length === 0) return null;
        return rows[0] as DentalChart;
    }

    static async getChartByPublicId(client: DBClient, companyId: number, publicId: string): Promise<DentalChart | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dc.*, c.public_id AS customer_public_id, c.name AS customer_name
             FROM dental_charts dc
             JOIN customers c ON dc.customer_id = c.id
             WHERE dc.company_id = ? AND dc.public_id = ? AND dc.is_deleted = 0
             LIMIT 1`,
            [companyId, publicId]
        );

        if (!rows || rows.length === 0) return null;
        return rows[0] as DentalChart;
    }

    static async createChart(
        client: DBClient,
        companyId: number,
        data: { public_id: string; customer_id: number; dentition?: string; notes?: string | null }
    ): Promise<number> {
        const dentition = data.dentition || 'permanent';
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO dental_charts (public_id, company_id, customer_id, dentition, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [data.public_id, companyId, data.customer_id, dentition, data.notes || null]
        );
        return result.insertId;
    }

    static async updateChart(
        client: DBClient,
        companyId: number,
        chartId: number,
        data: { dentition?: string | undefined; notes?: string | null | undefined }
    ): Promise<void> {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.dentition !== undefined) {
            updates.push('dentition = ?');
            params.push(data.dentition);
        }
        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }

        if (updates.length === 0) return;

        params.push(chartId, companyId);
        await client.query<ResultSetHeader>(
            `UPDATE dental_charts
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = ? AND company_id = ? AND is_deleted = 0`,
            params
        );
    }

    static async getTeethByChartId(client: DBClient, chartId: number, companyId: number): Promise<DentalChartTooth[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT *
             FROM dental_chart_teeth
             WHERE chart_id = ? AND company_id = ? AND is_deleted = 0
             ORDER BY tooth_code ASC`,
            [chartId, companyId]
        );
        return rows as DentalChartTooth[];
    }

    static async upsertTooth(
        client: DBClient,
        companyId: number,
        chartId: number,
        toothCode: number,
        condition: string,
        notes?: string | null
    ): Promise<void> {
        await client.query<ResultSetHeader>(
            `INSERT INTO dental_chart_teeth (public_id, company_id, chart_id, tooth_code, \`condition\`, notes)
             VALUES (UUID(), ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 \`condition\` = VALUES(\`condition\`),
                 notes = COALESCE(VALUES(notes), notes),
                 is_deleted = 0,
                 updated_at = NOW()`,
            [companyId, chartId, toothCode, condition, notes || null]
        );
    }

    static async getProceduresByChartId(client: DBClient, chartId: number, companyId: number): Promise<DentalProcedure[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT 
                dp.*,
                c.public_id AS customer_public_id,
                s.public_id AS service_public_id,
                s.name AS service_name,
                u.public_id AS professional_user_public_id,
                u.full_name AS professional_user_name,
                so.public_id AS sales_order_public_id,
                so.status AS sales_order_status
             FROM dental_procedures dp
             JOIN customers c ON dp.customer_id = c.id
             LEFT JOIN services s ON dp.service_id = s.id
             LEFT JOIN users u ON dp.professional_user_id = u.id
             LEFT JOIN sales_orders so ON dp.sales_order_id = so.id
             WHERE dp.chart_id = ? AND dp.company_id = ? AND dp.is_deleted = 0
             ORDER BY dp.created_at DESC`,
            [chartId, companyId]
        );
        return rows as DentalProcedure[];
    }

    static async getProcedureByPublicId(client: DBClient, companyId: number, publicId: string): Promise<DentalProcedure | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT 
                dp.*,
                c.public_id AS customer_public_id,
                s.public_id AS service_public_id,
                s.name AS service_name,
                u.public_id AS professional_user_public_id,
                u.full_name AS professional_user_name,
                so.public_id AS sales_order_public_id,
                so.status AS sales_order_status
             FROM dental_procedures dp
             JOIN customers c ON dp.customer_id = c.id
             LEFT JOIN services s ON dp.service_id = s.id
             LEFT JOIN users u ON dp.professional_user_id = u.id
             LEFT JOIN sales_orders so ON dp.sales_order_id = so.id
             WHERE dp.public_id = ? AND dp.company_id = ? AND dp.is_deleted = 0
             LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) return null;
        return rows[0] as DentalProcedure;
    }

    static async createProcedure(
        client: DBClient,
        data: {
            public_id: string;
            company_id: number;
            chart_id: number;
            customer_id: number;
            tooth_code?: number | null;
            region?: string;
            faces?: string | null;
            service_id?: number | null;
            unit_price: number;
            status?: string;
            sales_order_id?: number | null;
            sales_item_id?: number | null;
            professional_user_id?: number | null;
            planned_at?: string | Date | null;
            performed_at?: string | Date | null;
            notes?: string | null;
            created_by_user_id?: number | null;
        }
    ): Promise<number> {
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO dental_procedures (
                public_id, company_id, chart_id, customer_id, tooth_code,
                region, faces, service_id, unit_price, status,
                sales_order_id, sales_item_id, professional_user_id,
                planned_at, performed_at, notes, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.public_id,
                data.company_id,
                data.chart_id,
                data.customer_id,
                data.tooth_code ?? null,
                data.region || 'tooth',
                data.faces || null,
                data.service_id ?? null,
                data.unit_price || 0.00,
                data.status || 'planned',
                data.sales_order_id ?? null,
                data.sales_item_id ?? null,
                data.professional_user_id ?? null,
                data.planned_at || null,
                data.performed_at || null,
                data.notes || null,
                data.created_by_user_id ?? null,
            ]
        );
        return result.insertId;
    }

    static async updateProcedure(
        client: DBClient,
        companyId: number,
        procedureId: number,
        data: Partial<{
            tooth_code: number | null;
            region: string;
            faces: string | null;
            service_id: number | null;
            unit_price: number;
            status: string;
            sales_order_id: number | null;
            sales_item_id: number | null;
            professional_user_id: number | null;
            planned_at: string | Date | null;
            performed_at: string | Date | null;
            notes: string | null;
        }>
    ): Promise<void> {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.tooth_code !== undefined) {
            updates.push('tooth_code = ?');
            params.push(data.tooth_code);
        }
        if (data.region !== undefined) {
            updates.push('region = ?');
            params.push(data.region);
        }
        if (data.faces !== undefined) {
            updates.push('faces = ?');
            params.push(data.faces);
        }
        if (data.service_id !== undefined) {
            updates.push('service_id = ?');
            params.push(data.service_id);
        }
        if (data.unit_price !== undefined) {
            updates.push('unit_price = ?');
            params.push(data.unit_price);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (data.sales_order_id !== undefined) {
            updates.push('sales_order_id = ?');
            params.push(data.sales_order_id);
        }
        if (data.sales_item_id !== undefined) {
            updates.push('sales_item_id = ?');
            params.push(data.sales_item_id);
        }
        if (data.professional_user_id !== undefined) {
            updates.push('professional_user_id = ?');
            params.push(data.professional_user_id);
        }
        if (data.planned_at !== undefined) {
            updates.push('planned_at = ?');
            params.push(data.planned_at);
        }
        if (data.performed_at !== undefined) {
            updates.push('performed_at = ?');
            params.push(data.performed_at);
        }
        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }

        if (updates.length === 0) return;

        params.push(procedureId, companyId);
        await client.query<ResultSetHeader>(
            `UPDATE dental_procedures
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = ? AND company_id = ? AND is_deleted = 0`,
            params
        );
    }

    static async deleteProcedure(client: DBClient, companyId: number, procedureId: number): Promise<void> {
        await client.query<ResultSetHeader>(
            `UPDATE dental_procedures
             SET is_deleted = 1, updated_at = NOW()
             WHERE id = ? AND company_id = ? AND is_deleted = 0`,
            [procedureId, companyId]
        );
    }

    static async resetProceduresBySalesOrder(client: DBClient, companyId: number, salesOrderId: number): Promise<void> {
        await client.query<ResultSetHeader>(
            `UPDATE dental_procedures
             SET status = 'planned', sales_order_id = NULL, sales_item_id = NULL, updated_at = NOW()
             WHERE sales_order_id = ? AND company_id = ? AND is_deleted = 0`,
            [salesOrderId, companyId]
        );
    }

    static async countIncompleteProceduresBySalesOrder(client: DBClient, companyId: number, salesOrderId: number): Promise<number> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS count
             FROM dental_procedures
             WHERE sales_order_id = ? AND company_id = ? AND status != 'done' AND is_deleted = 0`,
            [salesOrderId, companyId]
        );
        return Number(rows[0]?.count || 0);
    }
}
