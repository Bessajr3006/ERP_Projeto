import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';

const routeDocPaths = [
    path.resolve(process.cwd(), 'src/routes/*.ts'),
    path.resolve(process.cwd(), 'dist/routes/*.js'),
    path.resolve(__dirname, '../routes/*.js'),
];

const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Bessa ERP API',
            version: '1.0.0',
            description: 'Documentacao da API do Bessa ERP.'
        },
        servers: [
            { url: '/api/v1', description: 'Base local' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                ApiError: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'error' },
                        message: { type: 'string', example: 'Mensagem do erro' }
                    }
                },
                ProductCategory: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        public_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        company_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Eletronicos' },
                        description: { type: 'string', nullable: true, example: 'Produtos eletronicos e acessorios' },
                        image_base64: {
                            type: 'string',
                            nullable: true,
                            description: 'Imagem da categoria em base64 puro, sem prefixo data:image/...',
                            example: null
                        },
                        product_count: { type: 'integer', example: 12 },
                        created_at: { type: 'string', format: 'date-time', example: '2026-05-31T10:00:00.000Z' },
                        updated_at: { type: 'string', format: 'date-time', example: '2026-05-31T10:00:00.000Z' }
                    }
                },
                CreateProductCategoryRequest: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', minLength: 1, example: 'Eletronicos' },
                        description: { type: 'string', nullable: true, example: 'Produtos eletronicos e acessorios' },
                        image_base64: {
                            type: 'string',
                            nullable: true,
                            description: 'Imagem da categoria em base64 puro, sem prefixo data:image/...',
                            example: null
                        }
                    }
                },
                UpdateProductCategoryRequest: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 1, example: 'Eletronicos' },
                        description: { type: 'string', nullable: true, example: 'Produtos eletronicos e acessorios' },
                        image_base64: {
                            type: 'string',
                            nullable: true,
                            description: 'Envie uma nova imagem em base64 puro, null para remover, ou omita para preservar a imagem atual.',
                            example: null
                        }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: routeDocPaths
});

export default swaggerSpec;
