import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { PurchaseOrder, CreatePurchaseData } from '../types/Order';
import { ProductService } from '../services/productService';
import { EntityService } from '../services/entityService';
import { BankAccountService } from '../services/bankAccountService';
import { toBrazilDate } from '../utils/dateTime';
import { AppError } from '../errors/AppError';

export class PurchaseRepository {
    static async getRecentPurchases(companyId: number, limit: number = 2000, includeSped: boolean = true): Promise<any[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.public_id, p.date, p.total_amount, p.status, p.nfe_key, p.nfe_issue_date, p.nfe_header_json,
             e.name as supplier_name, e.cnpj_cpf as supplier_cnpj,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count,
             'order' as source,
             0 as is_sped
             FROM purchase_orders p
             JOIN suppliers e ON p.supplier_id = e.id
             WHERE p.company_id = ?
             ORDER BY p.date DESC, p.id DESC
             LIMIT ?`,
            [companyId, limit]
        );

        if (!includeSped) {
            return rows;
        }

        // Fetch SPED Fiscal imported purchase notes from fechamentos
        let spedPurchases: any[] = [];
        try {
            const [fechRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, public_id, competencia, observacao, sped_data_json, created_at 
                 FROM fechamentos 
                 WHERE company_id = ? AND sped_data_json IS NOT NULL AND sped_data_json != ''
                 ORDER BY id DESC`,
                [companyId]
            );

            const seenNfeKeys = new Set<string>();
            for (const r of rows) {
                if (r.nfe_key) seenNfeKeys.add(String(r.nfe_key).trim());
            }

            for (const fech of fechRows) {
                if (!fech.sped_data_json) continue;
                let parsedSped: any = null;
                try {
                    parsedSped = typeof fech.sped_data_json === 'string' ? JSON.parse(fech.sped_data_json) : fech.sped_data_json;
                } catch (e) {
                    continue;
                }

                if (!parsedSped || !Array.isArray(parsedSped.documents)) continue;

                const participantsMap = new Map<string, any>();
                if (Array.isArray(parsedSped.participants)) {
                    for (const part of parsedSped.participants) {
                        if (part.codPart) participantsMap.set(String(part.codPart).trim(), part);
                        if (part.name) participantsMap.set(String(part.name).trim().toUpperCase(), part);
                    }
                }

                for (let idx = 0; idx < parsedSped.documents.length; idx++) {
                    const doc = parsedSped.documents[idx];
                    if (doc.indOper === '0' || doc.type === 'Entrada') {
                        const nfeKey = (doc.chvDoc || '').trim();
                        if (nfeKey && seenNfeKeys.has(nfeKey)) {
                            continue;
                        }
                        if (nfeKey) seenNfeKeys.add(nfeKey);

                        const part = participantsMap.get(String(doc.codPart || '').trim()) || 
                                     participantsMap.get(String(doc.partName || '').trim().toUpperCase());

                        let dateIso = '';
                        const rawDocDate = doc.dtDoc || doc.dtES || doc.dt_doc || doc.dt_e_s;
                        if (rawDocDate) {
                            const clean = String(rawDocDate).trim();
                            if (clean.includes('/')) {
                                const p = clean.split('/');
                                if (p.length === 3) dateIso = `${p[2]}-${p[1]!.padStart(2, '0')}-${p[0]!.padStart(2, '0')}`;
                            } else if (clean.includes('-')) {
                                dateIso = clean.slice(0, 10);
                            } else if (clean.length === 8) {
                                const d = clean.slice(0, 2);
                                const m = clean.slice(2, 4);
                                const y = clean.slice(4, 8);
                                dateIso = `${y}-${m}-${d}`;
                            }
                        }
                        if (!dateIso && fech.competencia) {
                            const compClean = String(fech.competencia).trim();
                            if (compClean.includes('/')) {
                                const p = compClean.split('/');
                                if (p.length === 2) dateIso = `${p[1]}-${p[0]!.padStart(2, '0')}-01`;
                            } else if (compClean.includes('-')) {
                                dateIso = `${compClean.slice(0, 7)}-01`;
                            } else if (compClean.length === 6) {
                                const first4 = parseInt(compClean.slice(0, 4), 10);
                                if (first4 >= 1990 && first4 <= 2100) {
                                    dateIso = `${compClean.slice(0, 4)}-${compClean.slice(4, 6)}-01`;
                                } else {
                                    dateIso = `${compClean.slice(2, 6)}-${compClean.slice(0, 2)}-01`;
                                }
                            }
                        }

                        const docPublicId = `sped-${fech.id}-${doc.chvDoc || (doc.numDoc + '_' + (doc.serie || '1')) || idx}`;

                        spedPurchases.push({
                            public_id: docPublicId,
                            fechamento_id: fech.id,
                            fechamento_public_id: fech.public_id,
                            competencia: fech.competencia,
                            date: dateIso || fech.created_at,
                            total_amount: Number(doc.vlDoc || 0),
                            status: doc.codSit === '02' ? 'cancelled' : 'completed',
                            nfe_key: doc.chvDoc || null,
                            nfe_issue_date: dateIso || null,
                            nfe_header_json: {
                                numero: doc.numDoc,
                                serie: doc.serie,
                                modelo: doc.reg?.includes('55') ? '55' : (doc.reg?.includes('CT-e') ? '57' : '55'),
                                reg: doc.reg,
                                source: 'SPED Fiscal',
                                competencia: fech.competencia,
                                vlIcms: doc.vlIcms || 0,
                                vlPis: doc.vlPis || 0,
                                vlCofins: doc.vlCofins || 0,
                                codSit: doc.codSit,
                                observacao: fech.observacao
                            },
                            supplier_name: doc.partName || part?.name || 'Fornecedor SPED',
                            supplier_cnpj: part?.cnpj_cpf || '',
                            items_count: 0,
                            is_sped: 1,
                            source: 'sped'
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching SPED purchase notes:', err);
        }

        const combined = [...rows, ...spedPurchases].sort((a, b) => {
            const dateA = new Date(a.date || a.nfe_issue_date || 0).getTime();
            const dateB = new Date(b.date || b.nfe_issue_date || 0).getTime();
            return dateB - dateA;
        });

        return combined.slice(0, limit);
    }

    static async createPurchaseOrder(companyId: number, userPublicId: string, data: CreatePurchaseData): Promise<PurchaseOrder> {
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [userRows] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE public_id = ? AND company_id = ? LIMIT 1', [userPublicId, companyId]);
            if (!userRows || userRows.length === 0) throw new Error('User context resolving failed inside DB logic');
            const userId = userRows[0]!.id;

            const supplier = await EntityService.getSupplierByPublicId(data.supplier_public_id, companyId);
            const bankAccount = await BankAccountService.getByPublicId(data.bank_account_public_id, companyId);

            const [catRows] = await conn.query<RowDataPacket[]>('SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1', [data.category_public_id, companyId]);
            if (!catRows || catRows.length === 0) throw new Error('Financial Category not found');
            const categoryId = catRows[0]!.id;

            let totalAmount = 0;

            const publicId = randomUUID();
            const orderDate = toBrazilDate(data.date);

            const [orderResult] = await conn.query<ResultSetHeader>(
                `INSERT INTO purchase_orders (public_id, company_id, supplier_id, total_amount, status, date, nfe_key, nfe_issue_date, nfe_header_json, nfe_xml) 
                 VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
                [
                    publicId,
                    companyId,
                    supplier.id,
                    0,
                    orderDate,
                    data.nfe_key || null,
                    data.nfe_issue_date || null,
                    data.nfe_header_json ? (typeof data.nfe_header_json === 'string' ? data.nfe_header_json : JSON.stringify(data.nfe_header_json)) : null,
                    data.nfe_xml || null
                ]
            );
            const purchaseId = orderResult.insertId;

            for (const item of data.items) {
                const product = await ProductService.getByPublicId(item.product_public_id, companyId);
                const itemTotal = item.quantity * item.unit_price;
                totalAmount += itemTotal;

                await conn.query(
                    `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [purchaseId, product.id, item.quantity, item.unit_price, itemTotal]
                );

                await ProductService.recordMovement(conn, companyId, product.id, 'in', item.quantity, purchaseId, null);
            }

            await conn.query('UPDATE purchase_orders SET total_amount = ? WHERE id = ?', [totalAmount, purchaseId]);

            const transactionPublicId = randomUUID();
            const description = `Compra #${purchaseId} - ${supplier.name}`;

            await conn.query(
                `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, purchase_id, description, amount, type, date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expense', ?, 'paid')`,
                [transactionPublicId, companyId, bankAccount.id, categoryId, userId, purchaseId, description, totalAmount, orderDate]
            );

            await BankAccountService.updateBalance(conn, bankAccount.id, companyId, -totalAmount);

            await conn.commit();
            return this.getPurchaseByInternalId(purchaseId, companyId);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async getPurchaseByInternalId(id: number, companyId: number): Promise<PurchaseOrder> {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ? LIMIT 1', [id, companyId]);
        if (rows.length === 0) throw new AppError('Purchase Order not found', 404);
        return rows[0] as PurchaseOrder;
    }

    static async getPurchaseById(publicId: string, companyId: number): Promise<any> {
        if (publicId.startsWith('sped-')) {
            const parts = publicId.split('-');
            const fechId = parseInt(parts[1] || '0', 10);

            const [fechRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, public_id, competencia, observacao, sped_data_json, created_at 
                 FROM fechamentos 
                 WHERE id = ? AND company_id = ? LIMIT 1`,
                [fechId, companyId]
            );

            if (!fechRows || fechRows.length === 0 || !fechRows[0]) {
                throw new AppError('Nota Fiscal de Compra SPED não encontrada', 404);
            }

            const fech = fechRows[0]!;
            let parsedSped: any = null;
            try {
                parsedSped = typeof fech.sped_data_json === 'string' ? JSON.parse(fech.sped_data_json) : fech.sped_data_json;
            } catch (e) {
                throw new AppError('Erro ao ler dados SPED da nota fiscal', 500);
            }

            if (!parsedSped || !Array.isArray(parsedSped.documents)) {
                throw new AppError('Documentos SPED não encontrados no fechamento', 404);
            }

            const participantsMap = new Map<string, any>();
            if (Array.isArray(parsedSped.participants)) {
                for (const part of parsedSped.participants) {
                    if (part.codPart) participantsMap.set(String(part.codPart).trim(), part);
                    if (part.name) participantsMap.set(String(part.name).trim().toUpperCase(), part);
                }
            }

            for (let idx = 0; idx < parsedSped.documents.length; idx++) {
                const doc = parsedSped.documents[idx];
                const expectedDocId = `sped-${fech.id}-${doc.chvDoc || (doc.numDoc + '_' + (doc.serie || '1')) || idx}`;
                if (expectedDocId === publicId || (doc.chvDoc && publicId.includes(doc.chvDoc)) || (doc.numDoc && publicId.includes(doc.numDoc))) {
                    const part = participantsMap.get(String(doc.codPart || '').trim()) || 
                                 participantsMap.get(String(doc.partName || '').trim().toUpperCase());

                    let dateIso = '';
                    const rawDocDate = doc.dtDoc || doc.dtES || doc.dt_doc || doc.dt_e_s;
                    if (rawDocDate) {
                        const clean = String(rawDocDate).trim();
                        if (clean.includes('/')) {
                            const p = clean.split('/');
                            if (p.length === 3) dateIso = `${p[2]}-${p[1]!.padStart(2, '0')}-${p[0]!.padStart(2, '0')}`;
                        } else if (clean.includes('-')) {
                            dateIso = clean.slice(0, 10);
                        } else if (clean.length === 8) {
                            const d = clean.slice(0, 2);
                            const m = clean.slice(2, 4);
                            const y = clean.slice(4, 8);
                            dateIso = `${y}-${m}-${d}`;
                        }
                    }
                    if (!dateIso && fech.competencia) {
                        const compClean = String(fech.competencia).trim();
                        if (compClean.includes('/')) {
                            const p = compClean.split('/');
                            if (p.length === 2) dateIso = `${p[1]}-${p[0]!.padStart(2, '0')}-01`;
                        } else if (compClean.includes('-')) {
                            dateIso = `${compClean.slice(0, 7)}-01`;
                        } else if (compClean.length === 6) {
                            const first4 = parseInt(compClean.slice(0, 4), 10);
                            if (first4 >= 1990 && first4 <= 2100) {
                                dateIso = `${compClean.slice(0, 4)}-${compClean.slice(4, 6)}-01`;
                            } else {
                                dateIso = `${compClean.slice(2, 6)}-${compClean.slice(0, 2)}-01`;
                            }
                        }
                    }

                    return {
                        id: fech.id,
                        public_id: publicId,
                        company_id: companyId,
                        fechamento_id: fech.id,
                        fechamento_public_id: fech.public_id,
                        competencia: fech.competencia,
                        date: dateIso || fech.created_at,
                        total_amount: Number(doc.vlDoc || 0),
                        status: doc.codSit === '02' ? 'cancelled' : 'completed',
                        nfe_key: doc.chvDoc || null,
                        nfe_issue_date: dateIso || null,
                        nfe_header_json: {
                            numero: doc.numDoc,
                            serie: doc.serie,
                            modelo: doc.reg?.includes('55') ? '55' : (doc.reg?.includes('CT-e') ? '57' : '55'),
                            reg: doc.reg,
                            source: 'SPED Fiscal',
                            competencia: fech.competencia,
                            vlIcms: doc.vlIcms || 0,
                            vlPis: doc.vlPis || 0,
                            vlCofins: doc.vlCofins || 0,
                            codSit: doc.codSit,
                            observacao: fech.observacao
                        },
                        supplier_name: doc.partName || part?.name || 'Fornecedor SPED',
                        supplier_cnpj: part?.cnpj || part?.cpf || part?.cnpj_cpf || '',
                        supplier_street: part?.end || part?.street || '',
                        supplier_number: part?.num || part?.number || '',
                        supplier_neighborhood: part?.bairro || part?.neighborhood || '',
                        supplier_city: part?.city || part?.codMun || '',
                        supplier_state: part?.state || part?.uf || '',
                        items: [],
                        is_sped: 1,
                        source: 'sped'
                    };
                }
            }

            throw new AppError('Documento SPED específico não localizado', 404);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, e.name as supplier_name, e.cnpj_cpf as supplier_cnpj,
             e.street as supplier_street, e.number as supplier_number,
             e.neighborhood as supplier_neighborhood, e.city as supplier_city, e.state as supplier_state
             FROM purchase_orders p
             JOIN suppliers e ON p.supplier_id = e.id
             WHERE p.public_id = ? AND p.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );
        if (rows.length === 0) throw new AppError('Purchase Order not found', 404);
        const order = rows[0] as PurchaseOrder;

        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT pi.*, prod.name as product_name, prod.sku 
             FROM purchase_items pi
             JOIN products prod ON pi.product_id = prod.id
             WHERE pi.purchase_id = ?`,
            [order.id]
        );
        return { ...order, items };
    }

    static async cancelPurchaseOrder(publicId: string, companyId: number): Promise<void> {
        if (publicId.startsWith('sped-')) {
            throw new AppError('Documentos importados via SPED Fiscal devem ser ajustados diretamente no Fechamento ou reimportando o arquivo SPED.', 400);
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query<RowDataPacket[]>('SELECT id, status, total_amount FROM purchase_orders WHERE public_id = ? AND company_id = ? LIMIT 1 FOR UPDATE', [publicId, companyId]);
            if (rows.length === 0) throw new AppError('Purchase Order not found', 404);
            const order = rows[0] as any;

            if (order.status === 'cancelled') {
                throw new AppError('Purchase Order is already cancelled', 400);
            }

            const [items] = await conn.query<RowDataPacket[]>('SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?', [order.id]);
            for (const item of items) {
                await ProductService.recordMovement(conn, companyId, item.product_id, 'out', item.quantity, null, null);
            }

            const [txRows] = await conn.query<RowDataPacket[]>('SELECT id, bank_account_id, amount FROM transactions WHERE purchase_id = ? AND company_id = ? LIMIT 1', [order.id, companyId]);
            if (txRows.length > 0) {
                 const tx = txRows[0] as any;
                 await conn.query('UPDATE transactions SET status = "cancelled", description = CONCAT(description, " (Cancelado)") WHERE id = ?', [tx.id]);
                 await BankAccountService.updateBalance(conn, tx.bank_account_id, companyId, Number(tx.amount));
            }

            await conn.query('UPDATE purchase_orders SET status = "cancelled" WHERE id = ?', [order.id]);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}