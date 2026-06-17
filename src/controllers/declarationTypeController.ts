import { Request, Response, NextFunction } from 'express';
import { DeclarationTypeService, declarationTypeSchema } from '../services/declarationTypeService';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) { res.status(401).json({ message: 'Não autorizado' }); return; }
        
        const includeInactive = req.query.includeInactive === 'true';
        const types = await DeclarationTypeService.getAll(Number(companyId), includeInactive);
        res.json({ data: types });
    } catch (error) {
        next(error);
    }
};

export const getOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) { res.status(401).json({ message: 'Não autorizado' }); return; }

        const { id } = req.params;
        const type = await DeclarationTypeService.getByPublicId(Number(companyId), id as string);
        
        if (!type) {
            res.status(404).json({ message: 'Tipo de declaração não encontrado' });
            return;
        }
        res.json({ data: type });
    } catch (error) {
        next(error);
    }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) { res.status(401).json({ message: 'Não autorizado' }); return; }

        const validatedData = declarationTypeSchema.parse(req.body);
        const type = await DeclarationTypeService.create(Number(companyId), validatedData);
        
        res.status(201).json({ status: 'success', data: type });
    } catch (error) {
        next(error);
    }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) { res.status(401).json({ message: 'Não autorizado' }); return; }

        const { id } = req.params;
        const validatedData = declarationTypeSchema.parse(req.body);
        
        const type = await DeclarationTypeService.update(Number(companyId), id as string, validatedData);
        res.json({ status: 'success', data: type });
    } catch (error) {
        next(error);
    }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) { res.status(401).json({ message: 'Não autorizado' }); return; }

        const { id } = req.params;
        await DeclarationTypeService.delete(Number(companyId), id as string);
        
        res.json({ status: 'success', message: 'Tipo de declaração deletado com sucesso' });
    } catch (error) {
        next(error);
    }
};
