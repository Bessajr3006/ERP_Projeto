import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { AppError } from '../errors/AppError';
import { DentalRepository } from '../repositories/dentalRepository';
import { OrderRepository } from '../repositories/orderRepository';
import {
    DentalChartTooth,
    DentalProcedure,
    DentalChartDetails,
    UpdateDentalChartInput,
    CreateDentalProcedureInput,
    UpdateDentalProcedureInput,
    PerformDentalProcedureInput,
    DentalToothCondition,
    CreateDentalChartQuoteInput,
    DentalFace
} from '../types/Dental';
import { CreateSalesData, CreateSalesItemData } from '../types/Order';
import { toBrazilDate } from '../utils/dateTime';

function formatFaces(faces?: DentalFace[] | string | null): string | null {
    if (!faces) return null;
    return Array.isArray(faces) ? faces.join(',') : String(faces);
}

export class DentalService {
    static async getOrCreateChart(companyId: number, customerPublicId: string): Promise<DentalChartDetails> {
        const [custRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, public_id, name FROM customers WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, customerPublicId]
        );

        if (!custRows || custRows.length === 0) {
            throw new AppError('Paciente não encontrado', 404);
        }

        const customer = custRows[0]!;
        let chart = await DentalRepository.getChartByCustomerId(pool, companyId, customer.id);

        if (!chart) {
            const chartPublicId = randomUUID();
            await DentalRepository.createChart(pool, companyId, {
                public_id: chartPublicId,
                customer_id: customer.id,
                dentition: 'permanent',
                notes: null
            });
            chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        }

        if (!chart) {
            throw new AppError('Falha ao obter ou criar odontograma', 500);
        }

        const teeth = await DentalRepository.getTeethByChartId(pool, chart.id, companyId);
        const procedures = await DentalRepository.getProceduresByChartId(pool, chart.id, companyId);

        return {
            ...chart,
            teeth,
            procedures
        };
    }

    static async getChart(companyId: number, chartPublicId: string): Promise<DentalChartDetails> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        const teeth = await DentalRepository.getTeethByChartId(pool, chart.id, companyId);
        const procedures = await DentalRepository.getProceduresByChartId(pool, chart.id, companyId);

        return {
            ...chart,
            teeth,
            procedures
        };
    }

    static async updateChart(
        companyId: number,
        chartPublicId: string,
        data: UpdateDentalChartInput
    ): Promise<DentalChartDetails> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        await DentalRepository.updateChart(pool, companyId, chart.id, data);
        return this.getChart(companyId, chartPublicId);
    }

    static async updateToothCondition(
        companyId: number,
        chartPublicId: string,
        toothCode: number,
        condition: DentalToothCondition,
        notes?: string | null
    ): Promise<DentalChartTooth[]> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        await DentalRepository.upsertTooth(pool, companyId, chart.id, toothCode, condition, notes);
        return DentalRepository.getTeethByChartId(pool, chart.id, companyId);
    }

    static async listProcedures(companyId: number, chartPublicId: string): Promise<DentalProcedure[]> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        return DentalRepository.getProceduresByChartId(pool, chart.id, companyId);
    }

    static async createProcedure(
        companyId: number,
        chartPublicId: string,
        userId: number,
        data: CreateDentalProcedureInput
    ): Promise<DentalProcedure> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        let serviceId: number | null = null;
        let unitPrice: number = data.unit_price ?? 0;

        if (data.service_public_id) {
            const [srvRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, price FROM services WHERE company_id = ? AND public_id = ? LIMIT 1`,
                [companyId, data.service_public_id]
            );
            if (srvRows && srvRows.length > 0) {
                serviceId = srvRows[0]!.id;
                if (data.unit_price === undefined || data.unit_price === null) {
                    unitPrice = Number(srvRows[0]!.price || 0);
                }
            } else {
                throw new AppError('Serviço não encontrado', 404);
            }
        }

        const status = data.status || 'planned';
        if (status === 'planned' && !serviceId) {
            throw new AppError('O serviço é obrigatório para procedimentos planejados', 400);
        }

        let professionalUserId: number | null = null;
        if (data.professional_user_public_id) {
            const [userRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
                [companyId, data.professional_user_public_id]
            );
            if (userRows && userRows.length > 0) {
                professionalUserId = userRows[0]!.id;
            } else {
                throw new AppError('Profissional não encontrado', 404);
            }
        }

        const procedurePublicId = randomUUID();
        await DentalRepository.createProcedure(pool, {
            public_id: procedurePublicId,
            company_id: companyId,
            chart_id: chart.id,
            customer_id: chart.customer_id,
            tooth_code: data.tooth_code ?? null,
            region: data.region || 'tooth',
            faces: formatFaces(data.faces),
            service_id: serviceId,
            unit_price: unitPrice,
            status: status,
            sales_order_id: null,
            sales_item_id: null,
            professional_user_id: professionalUserId,
            planned_at: data.planned_at || (status === 'planned' ? new Date() : null),
            performed_at: data.performed_at || (status === 'done' ? new Date() : null),
            notes: data.notes || null,
            created_by_user_id: userId
        });

        const created = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
        if (!created) {
            throw new AppError('Falha ao recuperar procedimento criado', 500);
        }
        return created;
    }

    static async updateProcedure(
        companyId: number,
        procedurePublicId: string,
        data: UpdateDentalProcedureInput
    ): Promise<DentalProcedure> {
        const proc = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
        if (!proc) {
            throw new AppError('Procedimento não encontrado', 404);
        }

        const updates: any = {};

        if (data.tooth_code !== undefined) updates.tooth_code = data.tooth_code;
        if (data.region !== undefined) updates.region = data.region;
        if (data.faces !== undefined) updates.faces = formatFaces(data.faces);
        if (data.unit_price !== undefined) updates.unit_price = data.unit_price;
        if (data.status !== undefined) updates.status = data.status;
        if (data.planned_at !== undefined) updates.planned_at = data.planned_at;
        if (data.performed_at !== undefined) updates.performed_at = data.performed_at;
        if (data.notes !== undefined) updates.notes = data.notes;

        if (data.service_public_id !== undefined) {
            if (data.service_public_id === null) {
                updates.service_id = null;
            } else {
                const [srvRows] = await pool.query<RowDataPacket[]>(
                    `SELECT id, price FROM services WHERE company_id = ? AND public_id = ? LIMIT 1`,
                    [companyId, data.service_public_id]
                );
                if (srvRows && srvRows.length > 0) {
                    updates.service_id = srvRows[0]!.id;
                } else {
                    throw new AppError('Serviço não encontrado', 404);
                }
            }
        }

        if (data.professional_user_public_id !== undefined) {
            if (data.professional_user_public_id === null) {
                updates.professional_user_id = null;
            } else {
                const [userRows] = await pool.query<RowDataPacket[]>(
                    `SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
                    [companyId, data.professional_user_public_id]
                );
                if (userRows && userRows.length > 0) {
                    updates.professional_user_id = userRows[0]!.id;
                } else {
                    throw new AppError('Profissional não encontrado', 404);
                }
            }
        }

        await DentalRepository.updateProcedure(pool, companyId, proc.id, updates);

        const updated = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
        if (!updated) {
            throw new AppError('Falha ao recuperar procedimento atualizado', 500);
        }
        return updated;
    }

    static async deleteProcedure(companyId: number, procedurePublicId: string): Promise<void> {
        const proc = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
        if (!proc) {
            throw new AppError('Procedimento não encontrado', 404);
        }

        await DentalRepository.deleteProcedure(pool, companyId, proc.id);
    }

    static async createQuoteForProcedures(
        companyId: number,
        userPublicId: string,
        chartPublicId: string,
        input: CreateDentalChartQuoteInput
    ): Promise<any> {
        const chart = await DentalRepository.getChartByPublicId(pool, companyId, chartPublicId);
        if (!chart) {
            throw new AppError('Odontograma não encontrado', 404);
        }

        if (!input.procedure_public_ids || input.procedure_public_ids.length === 0) {
            throw new AppError('Nenhum procedimento selecionado para o orçamento', 400);
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const procedures: DentalProcedure[] = [];
            for (const procPubId of input.procedure_public_ids) {
                const proc = await DentalRepository.getProcedureByPublicId(conn, companyId, procPubId);
                if (!proc) {
                    throw new AppError(`Procedimento ${procPubId} não encontrado`, 404);
                }
                if (proc.chart_id !== chart.id) {
                    throw new AppError(`Procedimento ${procPubId} não pertence a este odontograma`, 400);
                }
                if (proc.status !== 'planned') {
                    throw new AppError(`Procedimento ${procPubId} não está com status planejado`, 400);
                }
                if (!proc.service_id || !proc.service_public_id) {
                    throw new AppError(`Procedimento ${procPubId} não possui serviço vinculado`, 400);
                }
                procedures.push(proc);
            }

            const items: CreateSalesItemData[] = procedures.map(proc => {
                let description = '';
                if (proc.tooth_code) {
                    description = `Dente ${proc.tooth_code}`;
                    if (proc.faces) {
                        description += ` – faces ${proc.faces.replace(/,/g, '/')}`;
                    }
                } else if (proc.region && proc.region !== 'mouth') {
                    const regionLabels: Record<string, string> = {
                        upper_arch: 'Arcada Superior',
                        lower_arch: 'Arcada Inferior',
                        quadrant: 'Quadrante'
                    };
                    description = regionLabels[proc.region] || proc.region;
                } else {
                    description = 'Boca Toda';
                }

                return {
                    service_public_id: proc.service_public_id!,
                    quantity: 1,
                    unit_price: Number(proc.unit_price),
                    description
                };
            });

            const quoteData: CreateSalesData = {
                customer_public_id: chart.customer_public_id,
                date: toBrazilDate(new Date()),
                observation: input.observation || 'Orçamento gerado a partir do Odontograma',
                items
            };

            const createdQuote = await OrderRepository.createQuote(companyId, userPublicId, quoteData, conn);

            // Vincula os itens criados aos procedimentos
            if (createdQuote.items && createdQuote.items.length === procedures.length) {
                for (let i = 0; i < procedures.length; i++) {
                    const proc = procedures[i]!;
                    const item = createdQuote.items[i]!;
                    await DentalRepository.updateProcedure(conn, companyId, proc.id, {
                        sales_order_id: createdQuote.id,
                        sales_item_id: item.id,
                        status: 'quoted'
                    });
                }
            } else {
                // Fallback para vincular o sales_order_id em todos
                for (const proc of procedures) {
                    await DentalRepository.updateProcedure(conn, companyId, proc.id, {
                        sales_order_id: createdQuote.id,
                        status: 'quoted'
                    });
                }
            }

            await conn.commit();
            return createdQuote;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async performProcedure(
        companyId: number,
        procedurePublicId: string,
        data: PerformDentalProcedureInput
    ): Promise<DentalProcedure> {
        const proc = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
        if (!proc) {
            throw new AppError('Procedimento não encontrado', 404);
        }

        // Procedimento quoted exige orçamento aprovado
        if (proc.status === 'quoted') {
            if (!proc.sales_order_id) {
                throw new AppError('Procedimento cotado sem orçamento vinculado', 400);
            }
            const [soRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, status FROM sales_orders WHERE id = ? AND company_id = ? AND is_deleted = 0 LIMIT 1`,
                [proc.sales_order_id, companyId]
            );
            if (!soRows || soRows.length === 0 || soRows[0]!.status === 'quote') {
                throw new AppError('Procedimento cotado exige que o orçamento esteja aprovado antes de ser realizado', 400);
            }
        }

        let professionalUserId = proc.professional_user_id;
        if (data.professional_user_public_id) {
            const [userRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
                [companyId, data.professional_user_public_id]
            );
            if (userRows && userRows.length > 0) {
                professionalUserId = userRows[0]!.id;
            } else {
                throw new AppError('Profissional não encontrado', 404);
            }
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const performedAt = data.performed_at ? new Date(data.performed_at) : new Date();

            await DentalRepository.updateProcedure(conn, companyId, proc.id, {
                status: 'done',
                professional_user_id: professionalUserId,
                performed_at: performedAt
            });

            // Se pertencer a uma ordem de venda/orçamento aprovado, verifica se todos os procedimentos estão done
            if (proc.sales_order_id) {
                const remaining = await DentalRepository.countIncompleteProceduresBySalesOrder(
                    conn,
                    companyId,
                    proc.sales_order_id
                );
                if (remaining === 0) {
                    await conn.query<ResultSetHeader>(
                        `UPDATE sales_orders SET status = 'completed', updated_at = NOW() WHERE id = ? AND company_id = ?`,
                        [proc.sales_order_id, companyId]
                    );
                }
            }

            await conn.commit();

            const updated = await DentalRepository.getProcedureByPublicId(pool, companyId, procedurePublicId);
            if (!updated) {
                throw new AppError('Falha ao recuperar procedimento realizado', 500);
            }
            return updated;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
