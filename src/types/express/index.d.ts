import { JwtPayload } from 'jsonwebtoken';

// 1. Definimos o formato exato do payload do nosso JWT
// Isso garante que o autocomplete funcione em todos os controllers
export interface UserPayload extends JwtPayload {
    id: string; // O public_id (UUID) do usuário
    role: string; // Nível de acesso do usuário (suporta perfis dinâmicos)
    company_id: number; // Tenant (Empresa) atrelado ao usuário
    group_master_company_id?: number; // ID da empresa master quando o usuário trocou de contexto dentro do grupo
    general_admin_company_id?: number; // ID da empresa adm geral quando o usuário trocou de contexto globalmente
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
