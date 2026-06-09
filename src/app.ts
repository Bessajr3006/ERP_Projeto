/**
 * app.ts
 * -------
 * Cria e exporta o app Express SEM chamar .listen().
 * Isso permite que os testes (Supertest) importem o app diretamente,
 * sem precisar subir um servidor real em uma porta.
 */
import 'dotenv/config';
import './config/runtimeEnv';
import './config/timezone';
import 'express-async-errors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes';
import companyRoutes from './routes/companyRoutes';
import bankAccountRoutes from './routes/bankAccountRoutes';
import productRoutes from './routes/productRoutes';
import entityRoutes from './routes/entityRoutes';
import orderRoutes from './routes/orderRoutes';
import financeRoutes from './routes/financeRoutes';
import userRoutes from './routes/userRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import estoqueRoutes from './routes/estoqueRoutes';
import permissionRoutes from './routes/permissionRoutes';
import roleRoutes from './routes/roleRoutes';
import auditRoutes from './routes/auditRoutes';
import taskRoutes from './routes/taskRoutes';
import organizerRoutes from './routes/organizerRoutes';
import nfeRoutes from './routes/nfeRoutes';
import manifestationRoutes from './routes/manifestationRoutes';
import accountingRoutes from './routes/accountingRoutes';
import emailConfigRoutes from './routes/emailConfigRoutes';
import uiPreferenceRoutes from './routes/uiPreferenceRoutes';
import { StorageService } from './utils/storageService';
import { toBrazilIsoDateTime } from './utils/dateTime';
import httpLogger from './middlewares/httpLogger';
import { errorMiddleware } from './middlewares/errorMiddleware';
import swaggerSpec from './config/swagger';

StorageService.ensureDirectories();

const app = express();

// Disable ETags for API routes to prevent 304 Not Modified on dynamic data
app.set('etag', false);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            mediaSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
            frameSrc: ["'self'", "https:", "http:"],
            upgradeInsecureRequests: null,
        },
    },
}));
app.use(cors());

// ── Structured HTTP Logging ───────────────────────────────────────────────────
app.use(httpLogger);

// ── Rate Limit ────────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas requisições. Aguarde alguns instantes.' },
});
app.use('/api', limiter);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Cache-Control para rotas de API ───────────────────────────────────────────
// Impede que navegadores e proxies façam cache de respostas da API,
// evitando que dados sensíveis (tokens, financeiro) fiquem armazenados.
app.use('/api', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        const fileName = path.basename(filePath);
        if (
            ext === '.html'
            || ext === '.js'
            || ext === '.css'
            || ext === '.json'
            || fileName === 'sw.js'
        ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.svg' || ext === '.ico') {
            // Imagens podem ser cacheadas por 7 dias
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else {
            // Qualquer outro arquivo estático: sem cache por segurança
            res.setHeader('Cache-Control', 'no-store');
        }
        if (fileName === 'manifest.json') {
            res.setHeader('Content-Type', 'application/manifest+json; charset=UTF-8');
        }
    },
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads'), {
    maxAge: '7d',
    immutable: true,
}));

app.get('/favicon.ico', (_req: Request, res: Response) => {
    const faviconPath = path.join(__dirname, '../public', 'favicon.ico');
    res.sendFile(faviconPath, (err) => {
        if (err) {
            res.status(204).end();
        }
    });
});

// ── API Docs ────────────────────────────────────────────────────────────────
app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
        persistAuthorization: true,
    },
    customCss: `
        .bessa-swagger-category-card {
            margin: 24px auto 12px;
            max-width: 1460px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
            padding: 16px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
            font-family: sans-serif;
        }
        .bessa-swagger-category-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .bessa-swagger-category-title {
            margin: 0;
            color: #111827;
            font-size: 16px;
            font-weight: 700;
        }
        .bessa-swagger-category-description {
            margin: 4px 0 0;
            color: #4b5563;
            font-size: 14px;
        }
        .bessa-swagger-category-link {
            align-items: center;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            color: #374151;
            display: inline-flex;
            font-size: 14px;
            font-weight: 600;
            justify-content: center;
            padding: 8px 12px;
            text-decoration: none;
        }
        .bessa-swagger-category-grid {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 16px;
        }
        .bessa-swagger-category-route {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            color: #374151;
            font-size: 14px;
            padding: 8px 12px;
        }
        .bessa-swagger-method-get { color: #059669; font-weight: 700; }
        .bessa-swagger-method-post { color: #0284c7; font-weight: 700; }
        .bessa-swagger-method-put { color: #d97706; font-weight: 700; }
        .bessa-swagger-method-delete { color: #dc2626; font-weight: 700; }
        .bessa-swagger-route-path { margin-left: 8px; }
        @media (max-width: 900px) {
            .bessa-swagger-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
            .bessa-swagger-category-grid { grid-template-columns: 1fr; }
        }
    `,
    customJsStr: `
        window.addEventListener('load', function () {
            var SWAGGER_TOKEN_STORAGE_KEY = 'bessa_swagger_token';

            function tryPreauthorizeSwaggerToken(attempt) {
                var token = '';
                try {
                    token = String(localStorage.getItem(SWAGGER_TOKEN_STORAGE_KEY) || '').trim();
                } catch (_e) {
                    token = '';
                }

                if (!token) return;

                var ui = window.ui;
                if (ui && typeof ui.preauthorizeApiKey === 'function') {
                    ui.preauthorizeApiKey('bearerAuth', token);
                    return;
                }

                if ((attempt || 0) < 20) {
                    setTimeout(function () { tryPreauthorizeSwaggerToken((attempt || 0) + 1); }, 200);
                }
            }

            tryPreauthorizeSwaggerToken(0);

            var container = document.querySelector('section.swagger-ui.swagger-container');
            if (!container || document.getElementById('bessaProductCategorySwaggerCard')) return;

            var card = document.createElement('div');
            card.id = 'bessaProductCategorySwaggerCard';
            card.className = 'bessa-swagger-category-card';
            card.innerHTML = '<div class="bessa-swagger-category-header"><div><h2 class="bessa-swagger-category-title">Categoria de Produto</h2><p class="bessa-swagger-category-description">Endpoints de cadastro, listagem, edicao e remocao em /estoque/categories.</p></div><a href="#/Estoque" class="bessa-swagger-category-link">Ver no Swagger</a></div><div class="bessa-swagger-category-grid"><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-get">GET</span><span class="bessa-swagger-route-path">/estoque/categories</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-post">POST</span><span class="bessa-swagger-route-path">/estoque/categories</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-put">PUT</span><span class="bessa-swagger-route-path">/estoque/categories/{id}</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-delete">DELETE</span><span class="bessa-swagger-route-path">/estoque/categories/{id}</span></div></div>';
            container.insertBefore(card, container.firstChild);

            var salesCard = document.createElement('div');
            salesCard.id = 'bessaSalesOrderSwaggerCard';
            salesCard.className = 'bessa-swagger-category-card';
            salesCard.innerHTML = '<div class="bessa-swagger-category-header"><div><h2 class="bessa-swagger-category-title">Pedidos de Venda</h2><p class="bessa-swagger-category-description">Criar e listar pedidos de venda com itens, pagamentos e entrega em /orders/sales.</p></div><a href="#/Orders" class="bessa-swagger-category-link">Ver no Swagger</a></div><div class="bessa-swagger-category-grid"><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-post">POST</span><span class="bessa-swagger-route-path">/orders/sales</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-get">GET</span><span class="bessa-swagger-route-path">/orders/sales</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-get">GET</span><span class="bessa-swagger-route-path">/orders/customers/{id}/sales</span></div><div class="bessa-swagger-category-route"><span class="bessa-swagger-method-patch">PATCH</span><span class="bessa-swagger-route-path">/orders/{id}/status</span></div></div>';
            container.insertBefore(salesCard, container.firstChild);
        });
    `
} as any));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/bank-accounts', bankAccountRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/entities', entityRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/estoque', estoqueRoutes);
app.use(['/api/v1/sales', '/api/v1/orders'], orderRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/organizer', organizerRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/nfe', nfeRoutes);
app.use('/api/v1/manifestation', manifestationRoutes);
app.use('/api/v1/accounting', accountingRoutes);
app.use('/api/v1/email-config', emailConfigRoutes);
app.use('/api/v1/ui-preferences', uiPreferenceRoutes);

// ── Utility Routes ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', timestamp: toBrazilIsoDateTime() });
});


// Redirecionar a rota raiz para o index.html (página de login)
// Garante que o scanner de boas práticas do Render receba HTML com <meta viewport>
// em vez de texto puro, eliminando avisos de "viewport not specified".
app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(301, '/index.html');
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
