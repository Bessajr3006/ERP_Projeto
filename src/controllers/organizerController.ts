import { Request, Response } from 'express';
import { z } from 'zod';
import { OrganizerService } from '../services/organizerService';

const organizerStateSchema = z.object({
    lastBoardId: z.string().nullable().optional(),
    boards: z.array(z.unknown()),
}).passthrough();

const updateOrganizerSchema = z.object({
    state: organizerStateSchema,
});

export class OrganizerController {
    static async get(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const record = await OrganizerService.getByCompany(companyId);
        res.status(200).json({ status: 'success', data: record });
    }

    static async update(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const validated = updateOrganizerSchema.parse(req.body || {});
        const record = await OrganizerService.upsert(companyId, validated.state);
        res.status(200).json({ status: 'success', data: record });
    }
}