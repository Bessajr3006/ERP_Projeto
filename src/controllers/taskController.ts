import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { TaskService } from '../services/taskService';

const taskSchema = z.object({
    title: z.string().trim().min(1, 'Informe a descricao da tarefa.'),
    dueDate: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    status: z.enum(['pending', 'progress', 'completed']).optional(),
    personType: z.string().nullable().optional(),
    personId: z.string().nullable().optional(),
    attachments: z.array(z.record(z.unknown())).optional(),
    completedAt: z.string().nullable().optional(),
});

export class TaskController {
    static async list(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const tasks = await TaskService.list(companyId);
        res.status(200).json({ status: 'success', data: tasks });
    }

    static async create(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const validated = taskSchema.parse(req.body || {});
        const task = await TaskService.create(companyId, validated);
        res.status(201).json({ status: 'success', data: task });
    }

    static async update(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const taskId = req.params.id;
        if (!taskId) throw new AppError('Informe a tarefa.', 400);
        const validated = taskSchema.parse(req.body || {});
        const task = await TaskService.update(companyId, taskId, validated);
        res.status(200).json({ status: 'success', data: task });
    }

    static async delete(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const taskId = req.params.id;
        if (!taskId) throw new AppError('Informe a tarefa.', 400);
        await TaskService.delete(companyId, taskId);
        res.status(204).send();
    }
}