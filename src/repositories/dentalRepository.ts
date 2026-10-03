import { randomUUID } from 'crypto';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';
import { AppError } from '../errors/AppError';
import { OrderRepository } from './orderRepository';
import { toBrazilDate, toBrazilDbDateTime } from '../utils/dateTime';
import {
    DentalChartInput,
    DentalChartUpdateInput,
    DentalPerformInput,
    DentalProcedureInput,
    DentalProcedureRow,
    DentalQuoteInput,
    DentalToothInput,
} from '../types/Dental';

type DBClient = typeof pool | PoolConnection;

const LINKED_STATUSES = new Set(['quoted', 'approved', 'done']);

function facesToDb(faces?: string[] | null): string | null {
    if (!faces || faces.length === 0) return null;
    return Array.from(new Set(faces)).join(',');
}

function facesFromDb(faces: unknown): string[] {
    if (!faces) return [];
    if (Array.isArray(faces)) return faces.map(String);
    return String(faces).split(',').map((f) => f.trim()).filter(Boolean);
}

const REGION_LABELS: Record<string, string> = {
    upper_arch: 'Arcada superior',
    lower_arch: 'Arcada inferior',
    mouth: 'Boca toda',
};

/** Monta a descrição do item do orçamento, ex.: "Dente 16 – faces M/O". */
export function buildProcedureDescription(proc: { region: string; tooth_code: number | null; faces: unknown }): string {
    const faces = facesFromDb(proc.faces);
    if (proc.region === 'tooth' && proc.tooth_code) {
        const facesText = faces.length > 0 ? ` – ${faces.length > 1 ? 'faces' : 'face'} ${faces.join('/')}` : '';
        return `Dente ${proc.tooth_code}${facesText}`;
    }
    if (proc.region === 'quadrant') {
        return proc.tooth_code ? `Quadrante ${Math.floor(Number(proc.tooth_code) / 10)}` : 'Quadrante';
    }
    return REGION_LABELS[proc.region] || 'Procedimento odontológico';
}

export class DentalRepository {
    static async resolveCustomer(client: DBClient, companyId: number, customerPublicId: string): Promise<{ id: number; public_id: string; name: string }> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id, public_id, name FROM customers WHERE public_id = ? AND company_id = ? LIMIT 1',
            [customerPublicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new AppError('Paciente (cliente) não encontrado.', 404);
        return { id: Number(row.id), public_id: String(row.public_id), name: String(row.name) };
    }

    static async resolveUserId(client: DBClient, companyId: number, userPublicId?: string | null): Promise<number | null> {
        const value = String(userPublicId || '').trim();
        if (!value) return null;
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE public_id = ? AND company_id = ? LIMIT 1',
            [value, companyId]
        );
        return rows?.[0] ? Number(rows[0]!.id) : null;
    }

    static async requireUserId(client: DBClient, companyId: number, userPublicId: string): Promise<number> {
        const id = await this.resolveUserId(client, companyId, userPublicId);
        if (!id) throw new AppError('Profissional (usuário) não encontrado.', 404);
        return id;
    }

    static async resolveService(client: DBClient, companyId: number, servicePublicId: string): Promise<{ id: number; price: number; name: string }> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id, name, price FROM services WHERE public_id = ? AND company_id = ? LIMIT 1',
            [servicePublicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new AppError('Serviço não encontrado.', 404);
        return { id: Number(row.id), price: Number(row.price || 0), name: String(row.name) };
    }

    static async getChartRowByPublicId(client: DBClient, companyId: number, chartPublicId: string, forUpdate = false): Promise<any> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dc.*, c.public_id AS customer_public_id, c.name AS customer_name
             FROM dental_charts dc
             JOIN customers c ON c.id = dc.customer_id
             WHERE dc.public_id = ? AND dc.company_id = ? AND dc.is_deleted = 0
             LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
            [chartPublicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new AppError('Odontograma não encontrado.', 404);
        return row;
    }

    static async getChartRowByCustomerId(client: DBClient, companyId: number, customerId: number): Promise<any | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dc.*, c.public_id AS customer_public_id, c.name AS customer_name
             FROM dental_charts dc
             JOIN customers c ON c.id = dc.customer_id
             WHERE dc.customer_id = ? AND dc.company_id = ? AND dc.is_deleted = 0
             LIMIT 1`,
            [customerId, companyId]
        );
        return rows?.[0] || null;
    }

    static async listTeeth(client: DBClient, companyId: number, chartId: number): Promise<any[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT public_id, tooth_code, \`condition\`, notes, updated_at
             FROM dental_chart_teeth
             WHERE chart_id = ? AND company_id = ? AND is_deleted = 0
             ORDER BY tooth_code ASC`,
            [chartId, companyId]
        );
        return rows.map((r) => ({ ...r, tooth_code: Number(r.tooth_code) }));
    }

    static async listProcedures(client: DBClient, companyId: number, chartId: number): Promise<any[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dp.public_id, dp.tooth_code, dp.region, dp.faces, dp.unit_price, dp.status,
                    dp.planned_at, dp.performed_at, dp.notes, dp.created_at, dp.updated_at,
                    s.public_id AS service_public_id, s.name AS service_name,
                    so.public_id AS sales_order_public_id, so.id AS sales_order_number, so.status AS sales_order_status,
                    pu.public_id AS professional_user_public_id, pu.full_name AS professional_name,
                    cu.full_name AS created_by_name
             FROM dental_procedures dp
             LEFT JOIN services s ON s.id = dp.service_id
             LEFT JOIN sales_orders so ON so.id = dp.sales_order_id
             LEFT JOIN users pu ON pu.id = dp.professional_user_id
             LEFT JOIN users cu ON cu.id = dp.created_by_user_id
             WHERE dp.chart_id = ? AND dp.company_id = ? AND dp.is_deleted = 0
             ORDER BY dp.created_at ASC, dp.id ASC`,
            [chartId, companyId]
        );
        return rows.map((r) => this.mapProcedure(r));
    }

    static mapProcedure(r: any): any {
        return {
            ...r,
            tooth_code: r.tooth_code === null || r.tooth_code === undefined ? null : Number(r.tooth_code),
            faces: facesFromDb(r.faces),
            unit_price: Number(r.unit_price || 0),
            description: buildProcedureDescription(r),
        };
    }

    static async getFullChart(client: DBClient, companyId: number, chartRow: any): Promise<any> {
        const chartId = Number(chartRow.id);
        const [teeth, procedures] = await Promise.all([
            this.listTeeth(client, companyId, chartId),
            this.listProcedures(client, companyId, chartId),
        ]);
        return {
            public_id: chartRow.public_id,
            customer_public_id: chartRow.customer_public_id,
            customer_name: chartRow.customer_name,
            dentition: chartRow.dentition,
            notes: chartRow.notes,
            created_at: chartRow.created_at,
            updated_at: chartRow.updated_at,
            teeth,
            procedures,
        };
    }

    static async getChartByCustomer(companyId: number, customerPublicId: string): Promise<any | null> {
        const customer = await this.resolveCustomer(pool, companyId, customerPublicId);
        const chart = await this.getChartRowByCustomerId(pool, companyId, customer.id);
        if (!chart) return null;
        return this.getFullChart(pool, companyId, chart);
    }

    static async getChart(companyId: number, chartPublicId: string): Promise<any> {
        const chart = await this.getChartRowByPublicId(pool, companyId, chartPublicId);
        return this.getFullChart(pool, companyId, chart);
    }

    /** Cria o odontograma do paciente; se já existir, devolve o existente (idempotente). */
    static async createChart(companyId: number, data: DentalChartInput): Promise<{ chart: any; created: boolean }> {
        const customer = await this.resolveCustomer(pool, companyId, data.customer_public_id);
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, is_deleted FROM dental_charts WHERE company_id = ? AND customer_id = ? LIMIT 1',
            [companyId, customer.id]
        );
        const existing = rows?.[0];
        let created = false;
        if (existing) {
            if (Number(existing.is_deleted) === 1) {
                await pool.query('UPDATE dental_charts SET is_deleted = 0 WHERE id = ?', [existing.id]);
            }
        } else {
            await pool.query<ResultSetHeader>(
                `INSERT INTO dental_charts (public_id, company_id, customer_id, dentition, notes)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_deleted = 0`,
                [randomUUID(), companyId, customer.id, data.dentition || 'permanent', data.notes || null]
            );
            created = true;
        }
        const chartRow = await this.getChartRowByCustomerId(pool, companyId, customer.id);
        return { chart: await this.getFullChart(pool, companyId, chartRow), created };
    }

    static async updateChart(companyId: number, chartPublicId: string, data: DentalChartUpdateInput): Promise<any> {
        const chart = await this.getChartRowByPublicId(pool, companyId, chartPublicId);
        const sets: string[] = [];
        const params: any[] = [];
        if (data.dentition !== undefined) { sets.push('dentition = ?'); params.push(data.dentition); }
        if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes || null); }
        if (sets.length > 0) {
            params.push(chart.id, companyId);
            await pool.query(`UPDATE dental_charts SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
        }
        return this.getChart(companyId, chartPublicId);
    }

    static async upsertTeeth(companyId: number, chartPublicId: string, teeth: DentalToothInput[]): Promise<any[]> {
        const chart = await this.getChartRowByPublicId(pool, companyId, chartPublicId);
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const tooth of teeth) {
                await conn.query(
                    `INSERT INTO dental_chart_teeth (public_id, company_id, chart_id, tooth_code, \`condition\`, notes)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE \`condition\` = VALUES(\`condition\`), notes = VALUES(notes), is_deleted = 0`,
                    [randomUUID(), companyId, chart.id, tooth.tooth_code, tooth.condition, tooth.notes ?? null]
                );
            }
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
        return this.listTeeth(pool, companyId, Number(chart.id));
    }

    static async getProcedureRow(client: DBClient, companyId: number, procedurePublicId: string, forUpdate = false): Promise<DentalProcedureRow> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT * FROM dental_procedures WHERE public_id = ? AND company_id = ? AND is_deleted = 0 LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
            [procedurePublicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new AppError('Procedimento não encontrado.', 404);
        return row as unknown as DentalProcedureRow;
    }

    static async getProcedureView(client: DBClient, companyId: number, procedureId: number): Promise<any> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT dp.public_id, dp.tooth_code, dp.region, dp.faces, dp.unit_price, dp.status,
                    dp.planned_at, dp.performed_at, dp.notes, dp.created_at, dp.updated_at,
                    s.public_id AS service_public_id, s.name AS service_name,
                    so.public_id AS sales_order_public_id, so.id AS sales_order_number, so.status AS sales_order_status,
                    pu.public_id AS professional_user_public_id, pu.full_name AS professional_name
             FROM dental_procedures dp
             LEFT JOIN services s ON s.id = dp.service_id
             LEFT JOIN sales_orders so ON so.id = dp.sales_order_id
             LEFT JOIN users pu ON pu.id = dp.professional_user_id
             WHERE dp.id = ? AND dp.company_id = ? LIMIT 1`,
            [procedureId, companyId]
        );
        if (!rows?.[0]) throw new AppError('Procedimento não encontrado.', 404);
        return this.mapProcedure(rows[0]);
    }

    static async createProcedure(companyId: number, userPublicId: string, chartPublicId: string, data: DentalProcedureInput): Promise<any> {
        const chart = await this.getChartRowByPublicId(pool, companyId, chartPublicId);
        const region = data.region || 'tooth';
        const status = data.status || 'planned';

        let serviceId: number | null = null;
        let unitPrice = data.unit_price ?? null;
        if (data.service_public_id) {
            const service = await this.resolveService(pool, companyId, data.service_public_id);
            serviceId = service.id;
            if (unitPrice === null || unitPrice === undefined) unitPrice = service.price;
        }
        if (status === 'planned' && !serviceId) {
            throw new AppError('Informe o serviço do procedimento planejado.', 400);
        }

        const professionalId = data.professional_user_id
            ? await this.requireUserId(pool, companyId, data.professional_user_id)
            : null;
        const createdBy = await this.resolveUserId(pool, companyId, userPublicId);

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO dental_procedures
                (public_id, company_id, chart_id, customer_id, tooth_code, region, faces, service_id, unit_price, status,
                 professional_user_id, planned_at, notes, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                randomUUID(), companyId, chart.id, chart.customer_id,
                data.tooth_code ?? null, region, region === 'tooth' ? facesToDb(data.faces) : null,
                serviceId, Number(unitPrice || 0), status,
                professionalId, data.planned_at ? toBrazilDate(data.planned_at) : null,
                data.notes || null, createdBy,
            ]
        );
        return this.getProcedureView(pool, companyId, Number(result.insertId));
    }

    static async updateProcedure(companyId: number, procedurePublicId: string, data: DentalProcedureInput): Promise<any> {
        const current = await this.getProcedureRow(pool, companyId, procedurePublicId);
        const isLinked = LINKED_STATUSES.has(current.status);

        const structuralKeys: (keyof DentalProcedureInput)[] = ['tooth_code', 'region', 'faces', 'service_public_id', 'unit_price', 'status'];
        if (isLinked && structuralKeys.some((key) => data[key] !== undefined)) {
            throw new AppError('Procedimento já orçado/aprovado/realizado: apenas observações, profissional e data planejada podem ser alterados.', 409);
        }

        const sets: string[] = [];
        const params: any[] = [];
        const region = data.region ?? current.region;

        if (data.tooth_code !== undefined) { sets.push('tooth_code = ?'); params.push(data.tooth_code); }
        if (data.region !== undefined) { sets.push('region = ?'); params.push(data.region); }
        if (data.faces !== undefined || data.region !== undefined) {
            sets.push('faces = ?');
            params.push(region === 'tooth' ? facesToDb(data.faces ?? facesFromDb(current.faces)) : null);
        }
        let serviceId = current.service_id;
        if (data.service_public_id !== undefined) {
            if (data.service_public_id) {
                const service = await this.resolveService(pool, companyId, data.service_public_id);
                serviceId = service.id;
                sets.push('service_id = ?'); params.push(service.id);
                if (data.unit_price === undefined || data.unit_price === null) {
                    sets.push('unit_price = ?'); params.push(service.price);
                }
            } else {
                serviceId = null;
                sets.push('service_id = NULL');
            }
        }
        if (data.unit_price !== undefined && data.unit_price !== null) { sets.push('unit_price = ?'); params.push(Number(data.unit_price)); }
        if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
        const nextStatus = data.status ?? current.status;
        if (nextStatus === 'planned' && !serviceId) {
            throw new AppError('Informe o serviço do procedimento planejado.', 400);
        }
        if (data.professional_user_id !== undefined) {
            sets.push('professional_user_id = ?');
            params.push(data.professional_user_id ? await this.requireUserId(pool, companyId, data.professional_user_id) : null);
        }
        if (data.planned_at !== undefined) { sets.push('planned_at = ?'); params.push(data.planned_at ? toBrazilDate(data.planned_at) : null); }
        if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes || null); }

        if (sets.length > 0) {
            params.push(current.id, companyId);
            await pool.query(`UPDATE dental_procedures SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
        }
        return this.getProcedureView(pool, companyId, Number(current.id));
    }

    static async deleteProcedure(companyId: number, procedurePublicId: string): Promise<void> {
        const current = await this.getProcedureRow(pool, companyId, procedurePublicId);
        if (LINKED_STATUSES.has(current.status)) {
            throw new AppError('Procedimento orçado, aprovado ou realizado não pode ser excluído. Exclua o orçamento antes (o procedimento volta a "planejado").', 409);
        }
        await pool.query('UPDATE dental_procedures SET is_deleted = 1 WHERE id = ? AND company_id = ?', [current.id, companyId]);
    }

    /**
     * Gera um orçamento (sales_orders status 'quote') com um item por procedimento planejado selecionado,
     * vinculando os procedimentos ao pedido/itens e marcando-os como 'quoted'. Tudo em uma transação.
     */
    static async generateQuote(companyId: number, chartPublicId: string, data: DentalQuoteInput): Promise<any> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const chart = await this.getChartRowByPublicId(conn, companyId, chartPublicId, true);

            const ids = Array.from(new Set(data.procedure_public_ids));
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT dp.*, s.public_id AS service_public_id, s.name AS service_name
                 FROM dental_procedures dp
                 LEFT JOIN services s ON s.id = dp.service_id
                 WHERE dp.company_id = ? AND dp.chart_id = ? AND dp.is_deleted = 0 AND dp.public_id IN (?)
                 ORDER BY dp.tooth_code IS NULL, dp.tooth_code ASC, dp.id ASC
                 FOR UPDATE`,
                [companyId, chart.id, ids]
            );
            if (rows.length !== ids.length) {
                throw new AppError('Um ou mais procedimentos não foram encontrados neste odontograma.', 404);
            }
            const invalid = rows.filter((r) => r.status !== 'planned');
            if (invalid.length > 0) {
                throw new AppError('Somente procedimentos com status "planejado" podem ser orçados.', 409);
            }
            const withoutService = rows.filter((r) => !r.service_public_id);
            if (withoutService.length > 0) {
                throw new AppError('Todos os procedimentos selecionados precisam ter um serviço vinculado.', 400);
            }

            const now = new Date();
            const validity = data.validity_date || toBrazilDate(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000));
            const created = await OrderRepository.createQuoteWithConnection(conn, companyId, {
                customer_public_id: chart.customer_public_id,
                seller_public_id: data.seller_public_id || null,
                date: data.date || now.toISOString(),
                validity_date: validity,
                observation: data.observation || 'Orçamento gerado a partir do odontograma.',
                payment_terms: data.payment_terms || null,
                items: rows.map((r) => ({
                    service_public_id: String(r.service_public_id),
                    quantity: 1,
                    unit_price: Number(r.unit_price || 0),
                    description: buildProcedureDescription(r as any),
                })),
            });

            for (let index = 0; index < rows.length; index++) {
                await conn.query(
                    `UPDATE dental_procedures SET status = 'quoted', sales_order_id = ?, sales_item_id = ? WHERE id = ? AND company_id = ?`,
                    [created.saleId, created.itemIds[index], rows[index]!.id, companyId]
                );
            }

            await conn.commit();

            const total = rows.reduce((sum, r) => sum + Number(r.unit_price || 0), 0);
            return {
                quote_public_id: created.publicId,
                quote_number: created.saleId,
                total_amount: Math.round(total * 100) / 100,
                procedures_count: rows.length,
            };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Marca o procedimento como realizado. Se todos os procedimentos do pedido vinculado
     * estiverem realizados (ou cancelados), o pedido passa para 'completed'.
     */
    static async performProcedure(companyId: number, userPublicId: string, procedurePublicId: string, data: DentalPerformInput): Promise<any> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const current = await this.getProcedureRow(conn, companyId, procedurePublicId, true);
            if (current.status === 'quoted') {
                throw new AppError('Procedimento está em orçamento ainda não aprovado. Aprove o orçamento antes de marcá-lo como realizado.', 409);
            }
            if (current.status !== 'planned' && current.status !== 'approved') {
                throw new AppError('Somente procedimentos planejados ou aprovados podem ser marcados como realizados.', 409);
            }

            const professionalId = data.professional_user_id
                ? await this.requireUserId(conn, companyId, data.professional_user_id)
                : (current.professional_user_id || await this.resolveUserId(conn, companyId, userPublicId));
            const performedAt = toBrazilDbDateTime(data.performed_at || new Date());

            const sets = ["status = 'done'", 'professional_user_id = ?', 'performed_at = ?'];
            const params: any[] = [professionalId, performedAt];
            if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes || null); }
            params.push(current.id, companyId);
            await conn.query(`UPDATE dental_procedures SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);

            let orderCompleted = false;
            if (current.sales_order_id) {
                const [pendingRows] = await conn.query<RowDataPacket[]>(
                    `SELECT COUNT(*) AS total FROM dental_procedures
                     WHERE sales_order_id = ? AND company_id = ? AND is_deleted = 0 AND status NOT IN ('done', 'cancelled')`,
                    [current.sales_order_id, companyId]
                );
                if (Number(pendingRows?.[0]?.total || 0) === 0) {
                    const [upd] = await conn.query<ResultSetHeader>(
                        "UPDATE sales_orders SET status = 'completed' WHERE id = ? AND company_id = ? AND status = 'progress' AND is_deleted = 0",
                        [current.sales_order_id, companyId]
                    );
                    orderCompleted = Number(upd.affectedRows || 0) > 0;
                }
            }

            await conn.commit();
            const procedure = await this.getProcedureView(pool, companyId, Number(current.id));
            return { procedure, order_completed: orderCompleted };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
