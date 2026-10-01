import { Request, Response } from 'express';
import { z } from 'zod';
import { UiPreferenceService } from '../services/uiPreferenceService';
import { AppError } from '../errors/AppError';

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Cor invalida. Use formato hexadecimal #RRGGBB.').transform((v) => v.toLowerCase());

const uiPreferenceSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']),
    layout_align: z.enum(['left', 'center', 'right', 'responsive']),
    nav_align: z.enum(['left', 'center', 'right', 'responsive']).optional(),
    layout_width: z.enum(['system', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-screen-2xl', 'max-w-none']),
    nav_width: z.enum(['system', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-screen-2xl', 'max-w-none']).optional(),
    nav_color: hexColor,
    footer_color: hexColor,
    form_company_name: z.string().trim().max(150).nullable().optional(),
    form_profile: z.enum(['padrao', 'compacto', 'confortavel']).optional(),
    form_accent: z.string().trim().max(30).optional(),
    form_header_size: z.enum(['pequeno', 'medio', 'grande']).optional(),
    theme_toggle_visible: z.boolean().optional(),
    sales_cards_per_row: z.string().trim().max(120).nullable().optional(),
    sales_layout: z.enum(['drawer', 'split']).optional(),
    split_cart_size: z.enum(['small', 'medium', 'large']).optional(),
    wa_float_btn_visible: z.boolean().optional(),
    target_role: z.string().trim().max(80).nullable().optional(),
});

export class UiPreferenceController {
    static async get(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = await UiPreferenceService.getByCompanyAndUser(companyId, 'company_default');
        res.status(200).json({ status: 'success', data });
    }

    static async save(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;

        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
            throw new AppError('Only administrators can save UI preferences', 403);
        }

        const validated = uiPreferenceSchema.parse(req.body || {});

        const normalized = {
            theme: validated.theme,
            layout_align: validated.layout_align,
            nav_align: validated.nav_align || validated.layout_align,
            layout_width: validated.layout_width,
            nav_width: validated.nav_width || validated.layout_width,
            nav_color: validated.nav_color,
            footer_color: validated.footer_color,
            form_company_name: (validated.form_company_name || '').trim() || null,
            form_profile: validated.form_profile || 'padrao',
            form_accent: (validated.form_accent || 'brand').trim().toLowerCase(),
            form_header_size: validated.form_header_size || 'medio',
            theme_toggle_visible: validated.theme_toggle_visible !== false,
            sales_cards_per_row: (validated.sales_cards_per_row || '').trim() || null,
            sales_layout: validated.sales_layout || 'drawer',
            split_cart_size: validated.split_cart_size || 'medium',
            wa_float_btn_visible: validated.wa_float_btn_visible !== false,
        };

        const data = await UiPreferenceService.upsert(companyId, 'company_default', normalized);
        res.status(200).json({ status: 'success', data });
    }
}
