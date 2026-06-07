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
    static async getRecentPurchases(companyId: number, limit: number = 50): Promise<any[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.public_id, p.date, p.total_amount, p.status, e.name as supplier_name,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
             FROM purchase_orders p
             JOIN suppliers e ON p.supplier_id = e.id
             WHERE p.company_id = ?
             ORDER BY p.date DESC, p.id DESC
             LIMIT ?`,
            [companyId, limit]
        );
        return rows;
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
                `INSERT INTO purchase_orders (public_id, company_id, supplier_id, total_amount, status, date) 
                 VALUES (?, ?, ?, ?, 'completed', ?)`,
                [publicId, companyId, supplier.id, 0, orderDate]
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
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, e.name as supplier_name 
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