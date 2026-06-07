import { Request, Response } from 'express';
import { AuditService } from '../services/auditService';

export class AuditController {
    static async getActivities(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const activities = await AuditService.listActivities(companyId, req.query as Record<string, unknown>);
        res.status(200).json({ status: 'success', data: activities });
    }

    static async getUsers(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const users = await AuditService.listUsersActivitySummary(companyId);
        res.status(200).json({ status: 'success', data: users });
    }
}
