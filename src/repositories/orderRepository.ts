import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { PurchaseOrder, CreatePurchaseData, SalesOrder, CreateSalesData } from '../types/Order';
import { ProductService } from '../services/productService';
import { EntityService } from '../services/entityService';
import { BankAccountService } from '../services/bankAccountService';
import { toBrazilDate } from '../utils/dateTime';
import { CacheService } from '../services/cacheService';

export class OrderRepository {
    private static async resolveUserIdForContext(conn: any, companyId: number, userIdentifier: string): Promise<number> {
        const normalized = String(userIdentifier || '').trim();
        if (!normalized) {
            throw new Error('User context resolving failed inside DB logic');
        }

        const [userRowsRaw] = await conn.query(
            'SELECT id FROM users WHERE public_id = ? AND company_id = ? LIMIT 1',
            [normalized, companyId]
        );
        const userRows = userRowsRaw as RowDataPacket[];

        if (Array.isArray(userRows) && userRows.length > 0) {
            return Number(userRows[0]!.id);
        }

        // Compatibilidade com tokens legados que possam trazer id numérico em vez de public_id.
        const legacyNumericId = Number(normalized);
        if (Number.isInteger(legacyNumericId) && legacyNumericId > 0) {
            const [legacyRowsRaw] = await conn.query(
                'SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1',
                [legacyNumericId, companyId]
            );
            const legacyRows = legacyRowsRaw as RowDataPacket[];

            if (Array.isArray(legacyRows) && legacyRows.length > 0) {
                return Number(legacyRows[0]!.id);
            }
        }

        // Fallback para contextos técnicos (ex.: swagger token) sem user_id real no JWT.
        const [fallbackRowsRaw] = await conn.query(
            `SELECT id
             FROM users
             WHERE company_id = ?
               AND is_active = 1
             ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'super_admin' THEN 1 ELSE 2 END, id ASC
             LIMIT 1`,
            [companyId]
        );
        const fallbackRows = fallbackRowsRaw as RowDataPacket[];
        if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
            return Number(fallbackRows[0]!.id);
        }

        throw new Error('User context resolving failed inside DB logic');
    }

    static async createPurchaseOrder(companyId: number, userPublicId: string, data: CreatePurchaseData): Promise<PurchaseOrder> {
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const userId = await this.resolveUserIdForContext(conn, companyId, userPublicId);

            const supplier = await EntityService.getSupplierByPublicId(data.supplier_public_id, companyId);
            const bankAccount = await BankAccountService.getByPublicId(data.bank_account_public_id, companyId);

            const [catRows] = await conn.query<RowDataPacket[]>('SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1', [data.category_public_id, companyId]);
            if (!catRows || catRows.length === 0) throw new Error('Financial Category not found');
            const categoryId = catRows[0]!.id;

            let totalAmount = 0;

            const publicId = randomUUID();
            const orderDate = toBrazilDate(data.date);

            const [orderResult] = await conn.query<ResultSetHeader>(
                `INSERT INTO purchase_orders (public_id, company_id, supplier_id, total_amount, status, date) VALUES (?, ?, ?, ?, 'completed', ?)`,
                [publicId, companyId, supplier.id, 0, orderDate]
            );
            const purchaseId = orderResult.insertId;

            for (const item of data.items) {
                const product = await ProductService.getByPublicId(item.product_public_id, companyId);
                const itemTotal = item.quantity * item.unit_price;
                totalAmount += itemTotal;

                await conn.query(
                    `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)`,
                    [purchaseId, product.id, item.quantity, item.unit_price, itemTotal]
                );

                await ProductService.recordMovement(conn, companyId, product.id, 'in', item.quantity, purchaseId, null);
            }

            await conn.query('UPDATE purchase_orders SET total_amount = ? WHERE id = ?', [totalAmount, purchaseId]);

            const transactionPublicId = randomUUID();
            const description = `Purchase Order #${purchaseId} - ${supplier.name}`;

            await conn.query(
                `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, purchase_id, description, amount, type, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'expense', ?, 'paid')`,
                [transactionPublicId, companyId, bankAccount.id, categoryId, userId, purchaseId, description, totalAmount, orderDate]
            );

            await BankAccountService.updateBalance(conn, bankAccount.id, companyId, -totalAmount);

            CacheService.invalidate(`dashboard_${companyId}`);

            await conn.commit();
            return this.getPurchaseById(purchaseId, companyId);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async createSalesOrder(companyId: number, userPublicId: string, data: CreateSalesData): Promise<SalesOrder> {
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const userId = await this.resolveUserIdForContext(conn, companyId, userPublicId);

            let customerId = null;
            let customerName = 'Consumidor Final';
            if (data.customer_public_id) {
                const customer = await EntityService.getCustomerByPublicId(data.customer_public_id, companyId);
                customerId = customer.id;
                customerName = customer.name;
            }
            const bankAccount = await BankAccountService.getByPublicId(data.bank_account_public_id, companyId);

            const [catRows] = await conn.query<RowDataPacket[]>('SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1', [data.category_public_id, companyId]);
            if (!catRows || catRows.length === 0) throw new Error('Financial Category not found');
            const categoryId = catRows[0]!.id;

            let totalAmount = 0;

            const publicId = randomUUID();
            const orderDate = toBrazilDate(data.date);
            const nfeIssueDate = data.nfe_issue_date ? toBrazilDate(data.nfe_issue_date) : null;
            const nfeHeaderJson = data.nfe_header_json
                ? (typeof data.nfe_header_json === 'string' ? data.nfe_header_json : JSON.stringify(data.nfe_header_json))
                : null;

            const [orderResult] = await conn.query<ResultSetHeader>(
                `INSERT INTO sales_orders (public_id, company_id, customer_id, total_amount, status, date, nfe_key, nfe_issue_date, nfe_header_json, delivery_address) VALUES (?, ?, ?, ?, 'progress', ?, ?, ?, ?, ?)`,
                [publicId, companyId, customerId, 0, orderDate, data.nfe_key || null, nfeIssueDate, nfeHeaderJson, data.delivery_address || null]
            );
            const saleId = orderResult.insertId;

            for (const item of data.items) {
                const product = await ProductService.getByPublicId(item.product_public_id, companyId);
                const itemTotal = item.quantity * item.unit_price;
                totalAmount += itemTotal;

                await conn.query(
                    `INSERT INTO sales_items (sale_id, product_id, quantity, unit_price, total_price, xml_item_data) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        saleId,
                        product.id,
                        item.quantity,
                        item.unit_price,
                        itemTotal,
                        item.xml_item_data
                            ? (typeof item.xml_item_data === 'string' ? item.xml_item_data : JSON.stringify(item.xml_item_data))
                            : null,
                    ]
                );

                await ProductService.recordMovement(conn, companyId, product.id, 'out', item.quantity, null, saleId);
            }

            await conn.query('UPDATE sales_orders SET total_amount = ? WHERE id = ?', [totalAmount, saleId]);

            if (data.payments && data.payments.length > 0) {
                for (const payment of data.payments) {
                    const transactionPublicId = randomUUID();
                    const paymentDesc = `Venda #${saleId} - ${customerName} (${payment.method})`;
                    await conn.query(
                        `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, sale_id, description, amount, type, payment_method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'income', ?, ?, 'progress')`,
                        [transactionPublicId, companyId, bankAccount.id, categoryId, userId, saleId, paymentDesc, payment.amount, payment.method, orderDate]
                    );
                }
            } else {
                const transactionPublicId = randomUUID();
                const description = `Venda #${saleId} - ${customerName}`;
                await conn.query(
                    `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, sale_id, description, amount, type, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'income', ?, 'progress')`,
                    [transactionPublicId, companyId, bankAccount.id, categoryId, userId, saleId, description, totalAmount, orderDate]
                );
            }

            CacheService.invalidate(`dashboard_${companyId}`);

            await conn.commit();
            return this.getSaleById(saleId, companyId);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async getPurchaseById(id: number, companyId: number): Promise<PurchaseOrder> {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM purchase_orders WHERE id = ? AND company_id = ? LIMIT 1', [id, companyId]);
        if (rows.length === 0) throw new Error('Purchase Order not found');
        return rows[0] as PurchaseOrder;
    }

    static async getSaleById(id: number, companyId: number): Promise<SalesOrder> {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM sales_orders WHERE id = ? AND company_id = ? AND is_deleted = 0 LIMIT 1', [id, companyId]);
        if (rows.length === 0) throw new Error('Sales Order not found');
        return rows[0] as SalesOrder;
    }

    static async listSales(companyId: number, includeInactive = false): Promise<any[]> {
        const saleWhere = includeInactive ? 'so.company_id = ?' : 'so.company_id = ? AND so.is_deleted = 0';
        const [salesRows] = await pool.query<RowDataPacket[]>(
            `SELECT so.*, c.name as customer_name, c.cnpj_cpf as customer_document FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE ${saleWhere} ORDER BY so.created_at DESC`,
            [companyId]
        );

        if (!salesRows || salesRows.length === 0) return [];

        const saleIds = salesRows.map(s => Number(s.id)).filter(id => !isNaN(id));
        let itemsRows: RowDataPacket[] = [];
        
        if (saleIds.length > 0) {
            const itemWhere = includeInactive ? '' : 'si.is_deleted = 0 AND ';
            const query = `SELECT si.*, p.name as product_name, p.sku, p.ean, p.public_id as product_public_id FROM sales_items si JOIN products p ON si.product_id = p.id WHERE ${itemWhere}si.sale_id IN (${saleIds.join(',')})`;
            [itemsRows] = await pool.query<RowDataPacket[]>(query);
        }

        const itemsBySale = itemsRows.reduce((acc: any, item: any) => {
            if (!acc[item.sale_id]) acc[item.sale_id] = [];
            acc[item.sale_id].push(item);
            return acc;
        }, {});

        return salesRows.map(sale => ({
            ...sale,
            items: itemsBySale[sale.id] || []
        }));
    }

    static async softDeleteSale(id: number, companyId: number): Promise<void> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.query<ResultSetHeader>(
                'UPDATE sales_orders SET is_deleted = 1 WHERE id = ? AND company_id = ? AND is_deleted = 0',
                [id, companyId]
            );

            if (result.affectedRows !== 1) {
                throw new Error('Sales Order not found');
            }

            // Remove os lançamentos financeiros vinculados à venda excluída.
            await conn.query<ResultSetHeader>(
                'DELETE FROM transactions WHERE sale_id = ? AND company_id = ?',
                [id, companyId]
            );

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async hardDeleteInactiveSale(id: number, companyId: number): Promise<void> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [saleRows] = await conn.query<RowDataPacket[]>(
                'SELECT id, is_deleted FROM sales_orders WHERE id = ? AND company_id = ? LIMIT 1',
                [id, companyId]
            );

            const sale = saleRows?.[0];
            if (!sale) {
                throw new Error('Sales Order not found');
            }

            if (Number(sale.is_deleted || 0) !== 1) {
                throw new Error('Sales Order must be inactive before permanent deletion');
            }

            await conn.query<ResultSetHeader>('DELETE FROM sales_items WHERE sale_id = ?', [id]);
            await conn.query<ResultSetHeader>('DELETE FROM transactions WHERE sale_id = ? AND company_id = ?', [id, companyId]);

            const [deleteResult] = await conn.query<ResultSetHeader>(
                'DELETE FROM sales_orders WHERE id = ? AND company_id = ? AND is_deleted = 1',
                [id, companyId]
            );

            if (deleteResult.affectedRows !== 1) {
                throw new Error('Sales Order not found');
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async softDeleteSaleItem(saleId: number, itemId: number, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE sales_items si
             JOIN sales_orders so ON so.id = si.sale_id
             SET si.is_deleted = 1
             WHERE si.id = ? AND si.sale_id = ? AND so.company_id = ? AND so.is_deleted = 0 AND si.is_deleted = 0`,
            [itemId, saleId, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Sales Item not found');
    }

    static async setSaleActive(id: number, companyId: number, isActive: boolean): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE sales_orders SET is_deleted = ? WHERE id = ? AND company_id = ?',
            [isActive ? 0 : 1, id, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Sales Order not found');
    }

    static async setSaleItemActive(saleId: number, itemId: number, companyId: number, isActive: boolean): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE sales_items si
             JOIN sales_orders so ON so.id = si.sale_id
             SET si.is_deleted = ?
             WHERE si.id = ? AND si.sale_id = ? AND so.company_id = ?`,
            [isActive ? 0 : 1, itemId, saleId, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Sales Item not found');
    }

    static async updateSaleStatus(id: number, companyId: number, status: string, nfeEmittedAt?: Date): Promise<void> {
        let query = 'UPDATE sales_orders SET status = ?';
        const params: any[] = [status];

        if (status === 'invoiced' && nfeEmittedAt) {
            query += ', nfe_emitted_at = ?';
            params.push(nfeEmittedAt);
        } else if (status === 'invoiced' && !nfeEmittedAt) {
            query += ', nfe_emitted_at = NOW()';
        }

        query += ' WHERE id = ? AND company_id = ? AND is_deleted = 0';
        params.push(id, companyId);

        await pool.query(query, params);
    }

    static async listSalesByCustomer(customerPublicId: string, companyId: number): Promise<any[]> {
        const [salesRows] = await pool.query<RowDataPacket[]>(
            `SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.company_id = ? AND c.public_id = ? AND so.is_deleted = 0 ORDER BY so.created_at DESC`,
            [companyId, customerPublicId]
        );

        if (!salesRows || salesRows.length === 0) return [];

        const saleIds = salesRows.map((s: any) => Number(s.id)).filter((id: number) => !isNaN(id));
        let itemsRows: RowDataPacket[] = [];

        if (saleIds.length > 0) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT si.*, p.name as product_name, p.sku FROM sales_items si JOIN products p ON si.product_id = p.id WHERE si.is_deleted = 0 AND si.sale_id IN (${saleIds.join(',')})` 
            );
            itemsRows = rows;
        }

        const itemsBySale = itemsRows.reduce((acc: any, item: any) => {
            if (!acc[item.sale_id]) acc[item.sale_id] = [];
            acc[item.sale_id].push(item);
            return acc;
        }, {});

        return salesRows.map((sale: any) => ({ ...sale, items: itemsBySale[sale.id] || [] }));
    }

    static async listPurchasesBySupplier(supplierPublicId: string, companyId: number): Promise<any[]> {
        const [purchaseRows] = await pool.query<RowDataPacket[]>(
            `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.company_id = ? AND s.public_id = ? ORDER BY po.created_at DESC`,
            [companyId, supplierPublicId]
        );

        if (!purchaseRows || purchaseRows.length === 0) return [];

        const purchaseIds = purchaseRows.map((p: any) => Number(p.id)).filter((id: number) => !isNaN(id));
        let itemsRows: RowDataPacket[] = [];

        if (purchaseIds.length > 0) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT pi.*, p.name as product_name, p.sku FROM purchase_items pi JOIN products p ON pi.product_id = p.id WHERE pi.purchase_id IN (${purchaseIds.join(',')})` 
            );
            itemsRows = rows;
        }

        const itemsByPurchase = itemsRows.reduce((acc: any, item: any) => {
            if (!acc[item.purchase_id]) acc[item.purchase_id] = [];
            acc[item.purchase_id].push(item);
            return acc;
        }, {});

        return purchaseRows.map((purchase: any) => ({ ...purchase, items: itemsByPurchase[purchase.id] || [] }));
    }
}