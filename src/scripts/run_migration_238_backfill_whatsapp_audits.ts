import pool from '../config/db';
import { randomUUID } from 'crypto';

export async function runMigration238BackfillWhatsappAudits(): Promise<void> {
    console.log('│  Migration 238: Backfill revenue_whatsapp_audits from transactions │');

    try {
        // Busca transações que possuem whatsapp_sent > 0 mas ainda não têm auditoria correspondente
        const [transactions] = await pool.query<any[]>(`
            SELECT 
                t.id,
                t.public_id,
                t.company_id,
                t.user_id,
                t.description,
                t.amount,
                t.payment_method,
                t.billet_url,
                t.whatsapp_sent,
                t.created_at,
                t.updated_at,
                u.full_name as user_name,
                COALESCE(cu.name, 'Cliente') as cust_name,
                COALESCE(cu.phone, '') as cust_phone
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN customers cu ON t.customer_id = cu.id
            WHERE t.whatsapp_sent > 0
              AND NOT EXISTS (
                  SELECT 1 FROM revenue_whatsapp_audits a 
                  WHERE a.transaction_id = t.id AND a.company_id = t.company_id
              )
        `);

        if (!transactions || transactions.length === 0) {
            console.log('│  Migration 238: No pending transactions to backfill.       │');
            return;
        }

        console.log(`│  Migration 238: Backfilling ${transactions.length} transaction(s)...     │`);

        for (const tx of transactions) {
            const sendCount = Number(tx.whatsapp_sent) || 1;
            const billingType = tx.payment_method || 'boleto';
            const rawPhone = (tx.cust_phone || '').trim();
            const phone = rawPhone || 'Telefone não registrado';
            const auditPublicId = randomUUID();
            const logTime = tx.updated_at || tx.created_at || new Date();

            const messageText = `Olá, *${tx.cust_name || 'Cliente'}*!\n\nSegue em anexo a cobrança referente a *${tx.description || 'Receita'}* no valor de *R$ ${Number(tx.amount || 0).toFixed(2)}*.`;

            await pool.query(`
                INSERT INTO revenue_whatsapp_audits (
                    public_id,
                    company_id,
                    transaction_id,
                    transaction_public_id,
                    user_id,
                    user_name,
                    recipient_phone,
                    recipient_name,
                    billing_type,
                    status,
                    message_text,
                    media_file_name,
                    media_url,
                    is_automatic,
                    whatsapp_message_id,
                    raw_response,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, 0, NULL, ?, ?)
            `, [
                auditPublicId,
                tx.company_id,
                tx.id,
                tx.public_id,
                tx.user_id || null,
                tx.user_name || 'Sistema (Histórico)',
                phone,
                tx.cust_name || 'Cliente',
                billingType,
                messageText,
                billingType === 'boleto' ? 'Boleto.pdf' : 'Recibo.pdf',
                tx.billet_url || null,
                JSON.stringify({ note: `Histórico importado (Enviado ${sendCount}x)`, initialCount: sendCount }),
                logTime
            ]);
        }

        console.log('│  Migration 238: Backfill completed successfully!          │');
    } catch (err) {
        console.error('Migration 238 error:', err);
        throw err;
    }
}

if (require.main === module) {
    runMigration238BackfillWhatsappAudits()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
