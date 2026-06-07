import { JwtPayload } from 'jsonwebtoken';

// 1. Definimos o formato exato do payload do nosso JWT
// Isso garante que o autocomplete funcione em todos os controllers
export interface UserPayload extends JwtPayload {
    id: string; // O public_id (UUID) do usuário
    role: 'admin' | 'user' | 'operator' | 'financial' | 'manager' | 'seller' | 'contact' | 'accountant' | 'buyer' | 'service_provider' | 'super_admin'; // Nível de acesso do usuário
    company_id: number; // Tenant (Empresa) atrelado ao usuário
}

// 2. Sobrescrevemos (Declaration Merging) o namespace nativo do Express
declare global {
    namespace Express {
        export interface Request {
            // Injetamos a propriedade 'user' como opcional inicialmente, 
            // pois rotas públicas não terão esse dado.
            user?: UserPayload;
        }
    }
}
