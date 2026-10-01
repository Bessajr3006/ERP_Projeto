import { Request, Response } from 'express';
import { z } from 'zod';
import { EmployeeService } from '../services/employeeService';
import { AppError } from '../errors/AppError';

const createEmployeeSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(255, 'Nome muito longo'),
    cpf: z.string().trim().max(20).nullable().optional(),
    rg: z.string().trim().max(20).nullable().optional(),
    birth_date: z.string().trim().nullable().optional(),
    admission_date: z.string().trim().nullable().optional(),
    resignation_date: z.string().trim().nullable().optional(),
    salary: z.number().nonnegative('Salário deve ser maior ou igual a zero').optional(),
    position: z.string().trim().max(255).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    email: z.string().trim().max(255).nullable().optional(),
    address: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().max(255).nullable().optional(),
    state: z.string().trim().max(2).nullable().optional(),
    zip_code: z.string().trim().max(10).nullable().optional(),
    status: z.enum(['active', 'inactive']).optional()
});

const updateEmployeeSchema = createEmployeeSchema.partial();

export class EmployeeController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createEmployeeSchema.parse(req.body);

        const result = await EmployeeService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await EmployeeService.listByCompany(companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await EmployeeService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateEmployeeSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await EmployeeService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await EmployeeService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Employee deleted successfully'
        });
    }
}
