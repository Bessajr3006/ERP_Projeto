import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

export interface UiPreference {
    company_id: number;
    user_public_id: string;
    theme: 'light' | 'dark' | 'system';
    layout_align: 'left' | 'center' | 'right' | 'responsive';
    nav_align: 'left' | 'center' | 'right' | 'responsive';
    layout_width: 'system' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl' | 'max-w-screen-2xl' | 'max-w-none';
    nav_width: 'system' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl' | 'max-w-screen-2xl' | 'max-w-none';
    nav_color: string;
    footer_color: string;
    form_company_name: string | null;
    form_profile: 'padrao' | 'compacto' | 'confortavel';
    form_accent: string;
    form_header_size: 'pequeno' | 'medio' | 'grande';
    theme_toggle_visible: boolean;
    sales_cards_per_row?: string | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface UiPreferenceInput {
    theme: UiPreference['theme'];
    layout_align: UiPreference['layout_align'];
    nav_align: UiPreference['nav_align'];
    layout_width: UiPreference['layout_width'];
    nav_width: UiPreference['nav_width'];
    nav_color: string;
    footer_color: string;
    form_company_name: string | null;
    form_profile: UiPreference['form_profile'];
    form_accent: string;
    form_header_size: UiPreference['form_header_size'];
    theme_toggle_visible: boolean;
    sales_cards_per_row?: string | null;
}

type UiPreferenceRow = RowDataPacket & Omit<UiPreference, 'theme_toggle_visible'> & { theme_toggle_visible: number | boolean };
type ColumnExistsRow = RowDataPacket & { column_count: number };

function mapPreferenceRow(row: UiPreferenceRow): UiPreference {
    return {
        ...row,
        theme_toggle_visible: Boolean(row.theme_toggle_visible),
        sales_cards_per_row: row.sales_cards_per_row || null,
    };
}

export class UiPreferenceService {
    private static schemaReady = false;

    private static async columnExists(columnName: string): Promise<boolean> {
        const [rows] = await pool.query<ColumnExistsRow[]>(
            `SELECT COUNT(*) AS column_count
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'ui_preferences'
               AND COLUMN_NAME = ?`,
            [columnName]
        );

        return Number(rows[0]?.column_count || 0) > 0;
    }

    private static async addColumnIfMissing(columnName: string, definition: string): Promise<void> {
        if (await UiPreferenceService.columnExists(columnName)) {
            return;
        }

        await pool.query(`ALTER TABLE ui_preferences ADD COLUMN ${definition}`);
    }

    private static async ensureSchema(): Promise<void> {
        if (UiPreferenceService.schemaReady) {
            return;
        }

        await pool.query(
            `CREATE TABLE IF NOT EXISTS ui_preferences (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                user_public_id VARCHAR(80) NOT NULL,
                theme VARCHAR(20) NOT NULL DEFAULT 'dark',
                layout_align VARCHAR(20) NOT NULL DEFAULT 'responsive',
                nav_align VARCHAR(20) NOT NULL DEFAULT 'responsive',
                layout_width VARCHAR(30) NOT NULL DEFAULT 'system',
                nav_width VARCHAR(30) NOT NULL DEFAULT 'system',
                nav_color CHAR(7) NOT NULL DEFAULT '#0f172a',
                footer_color CHAR(7) NOT NULL DEFAULT '#0f172a',
                form_company_name VARCHAR(150) DEFAULT NULL,
                form_profile VARCHAR(20) NOT NULL DEFAULT 'padrao',
                form_accent VARCHAR(30) NOT NULL DEFAULT 'brand',
                form_header_size VARCHAR(20) NOT NULL DEFAULT 'medio',
                theme_toggle_visible TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_ui_preferences_company_user (company_id, user_public_id),
                INDEX idx_ui_preferences_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );

        await UiPreferenceService.addColumnIfMissing('form_company_name', `form_company_name VARCHAR(150) DEFAULT NULL AFTER footer_color`);
        await UiPreferenceService.addColumnIfMissing('nav_align', `nav_align VARCHAR(20) NOT NULL DEFAULT 'responsive' AFTER layout_align`);
        await UiPreferenceService.addColumnIfMissing('nav_width', `nav_width VARCHAR(30) NOT NULL DEFAULT 'system' AFTER layout_width`);
        await UiPreferenceService.addColumnIfMissing('form_profile', `form_profile VARCHAR(20) NOT NULL DEFAULT 'padrao' AFTER form_company_name`);
        await UiPreferenceService.addColumnIfMissing('form_accent', `form_accent VARCHAR(30) NOT NULL DEFAULT 'brand' AFTER form_profile`);
        await UiPreferenceService.addColumnIfMissing('form_header_size', `form_header_size VARCHAR(20) NOT NULL DEFAULT 'medio' AFTER form_accent`);
        await UiPreferenceService.addColumnIfMissing('theme_toggle_visible', `theme_toggle_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER form_header_size`);
        await UiPreferenceService.addColumnIfMissing('sales_cards_per_row', `sales_cards_per_row VARCHAR(120) DEFAULT NULL AFTER theme_toggle_visible`);

        UiPreferenceService.schemaReady = true;
    }

    static async getByCompanyAndUser(companyId: number, userPublicId: string): Promise<UiPreference | null> {
        await UiPreferenceService.ensureSchema();

        const [rows] = await pool.query<UiPreferenceRow[]>(
                `SELECT company_id, user_public_id, theme, layout_align, nav_align, layout_width, nav_width, nav_color, footer_color,
                    form_company_name, form_profile, form_accent, form_header_size, theme_toggle_visible, sales_cards_per_row,
                    created_at, updated_at
             FROM ui_preferences
             WHERE company_id = ? AND user_public_id = ?
             LIMIT 1`,
            [companyId, userPublicId]
        );

        return rows[0] ? mapPreferenceRow(rows[0]) : null;
    }

    static async upsert(companyId: number, userPublicId: string, data: UiPreferenceInput): Promise<UiPreference> {
        await UiPreferenceService.ensureSchema();

        await pool.query<ResultSetHeader>(
            `INSERT INTO ui_preferences
                     (company_id, user_public_id, theme, layout_align, nav_align, layout_width, nav_width, nav_color, footer_color, form_company_name, form_profile, form_accent, form_header_size, theme_toggle_visible, sales_cards_per_row)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                theme = VALUES(theme),
                layout_align = VALUES(layout_align),
                nav_align = VALUES(nav_align),
                layout_width = VALUES(layout_width),
                nav_width = VALUES(nav_width),
                nav_color = VALUES(nav_color),
                footer_color = VALUES(footer_color),
                form_company_name = VALUES(form_company_name),
                form_profile = VALUES(form_profile),
                form_accent = VALUES(form_accent),
                form_header_size = VALUES(form_header_size),
                theme_toggle_visible = VALUES(theme_toggle_visible),
                sales_cards_per_row = VALUES(sales_cards_per_row),
                updated_at = NOW()`,
            [
                companyId,
                userPublicId,
                data.theme,
                data.layout_align,
                data.nav_align,
                data.layout_width,
                data.nav_width,
                data.nav_color,
                data.footer_color,
                data.form_company_name,
                data.form_profile,
                data.form_accent,
                data.form_header_size,
                data.theme_toggle_visible ? 1 : 0,
                data.sales_cards_per_row || null,
            ]
        );

        const saved = await this.getByCompanyAndUser(companyId, userPublicId);
        if (!saved) {
            throw new Error('Falha ao carregar preferencias apos salvar.');
        }

        return saved;
    }
}
