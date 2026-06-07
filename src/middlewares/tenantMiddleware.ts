import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to enforce tenant data isolation.
 * Assumes `protectRoute` has already been run, and `req.user` is populated.
 */
export const requireTenantContext = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.company_id) {
        res.status(403).json({
            error: 'Forbidden. Tenant context missing. Please re-authenticate.'
        });
        return;
    }

    // The tenant (company_id) is now safely verified and accessible throughout controllers
    // e.g., const { company_id } = req.user;

    next();
};
