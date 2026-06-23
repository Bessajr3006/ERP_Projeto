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
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        public_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        company_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Refrigerante Coca-Cola 2L' },
                        description: { type: 'string', nullable: true, example: 'Refrigerante sabor cola garrafa 2 litros' },
                        sku: { type: 'string', nullable: true, example: 'REF-COCA-2L' },
                        ean: { type: 'string', nullable: true, example: '7891000100101' },
                        external_code: { type: 'string', nullable: true, example: 'EXT-1002' },
                        is_imported: { type: 'boolean', example: false },
                        ncm: { type: 'string', nullable: true, example: '22021000' },
                        cest: { type: 'string', nullable: true, example: '1701100' },
                        cost_price: { type: 'number', example: 5.50 },
                        selling_price: { type: 'number', example: 8.99 },
                        is_promotional: { type: 'boolean', example: false },
                        promotional_price: { type: 'number', example: 7.99 },
                        current_stock: { type: 'number', example: 150 },
                        min_stock: { type: 'number', example: 10 },
                        max_stock: { type: 'number', example: 500 },
                        category_id: { type: 'integer', nullable: true, example: 3 },
                        category_name: { type: 'string', nullable: true, example: 'Bebidas' },
                        stock_type_id: { type: 'integer', nullable: true, example: 1 },
                        stock_type_name: { type: 'string', nullable: true, example: 'Mercadoria para Revenda' },
                        manufacturer_id: { type: 'integer', nullable: true, example: 5 },
                        manufacturer_name: { type: 'string', nullable: true, example: 'Coca-Cola Indústrias' },
                        tax_rule_id: { type: 'integer', nullable: true, example: 2 },
                        tax_rule_name: { type: 'string', nullable: true, example: 'ICMS Substituição Tributária' },
                        measure_id: { type: 'integer', nullable: true, example: 1 },
                        measure_name: { type: 'string', nullable: true, example: 'Unidade' },
                        measure_abbreviation: { type: 'string', nullable: true, example: 'UN' },
                        image_url: { type: 'string', nullable: true, example: 'https://storage.googleapis.com/bessa-erp/products/coca.jpg' },
                        created_at: { type: 'string', format: 'date-time', example: '2026-05-31T10:00:00.000Z' },
                        updated_at: { type: 'string', format: 'date-time', example: '2026-05-31T10:00:00.000Z' }
                    }
                },
                CreateProductRequest: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', minLength: 2, example: 'Refrigerante Coca-Cola 2L' },
                        description: { type: 'string', example: 'Refrigerante sabor cola garrafa 2 litros' },
                        sku: { type: 'string', example: 'REF-COCA-2L' },
                        ean: { type: 'string', maxLength: 100, example: '7891000100101' },
                        external_code: { type: 'string', example: 'EXT-1002' },
                        is_imported: { type: 'boolean', example: false },
                        ncm: { type: 'string', maxLength: 8, example: '22021000' },
                        cest: { type: 'string', maxLength: 7, example: '1701100' },
                        cost_price: { type: 'number', minimum: 0, example: 5.50 },
                        selling_price: { type: 'number', minimum: 0, example: 8.99 },
                        initial_stock: { type: 'number', minimum: 0, example: 100 },
                        min_stock: { type: 'number', minimum: 0, example: 10 },
                        max_stock: { type: 'number', minimum: 0, example: 500 },
                        category_id: { type: 'integer', nullable: true, example: 3 },
                        stock_type_id: { type: 'integer', nullable: true, example: 1 },
                        manufacturer_id: { type: 'integer', nullable: true, example: 5 },
                        tax_rule_id: { type: 'integer', nullable: true, example: 2 },
                        measure_id: { type: 'integer', nullable: true, example: 1 },
                        image_base64: { type: 'string', nullable: true, description: 'Imagem em base64 sem prefixo data:image/...', example: null }
                    }
                },
                UpdateProductRequest: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 2, example: 'Refrigerante Coca-Cola 2L' },
                        description: { type: 'string', nullable: true, example: 'Refrigerante sabor cola garrafa 2 litros' },
                        sku: { type: 'string', nullable: true, example: 'REF-COCA-2L' },
                        ean: { type: 'string', maxLength: 100, nullable: true, example: '7891000100101' },
                        external_code: { type: 'string', nullable: true, example: 'EXT-1002' },
                        is_imported: { type: 'boolean', example: false },
                        ncm: { type: 'string', maxLength: 8, nullable: true, example: '22021000' },
                        cest: { type: 'string', maxLength: 7, nullable: true, example: '1701100' },
                        cost_price: { type: 'number', minimum: 0, example: 5.50 },
                        selling_price: { type: 'number', minimum: 0, example: 8.99 },
                        min_stock: { type: 'number', minimum: 0, example: 10 },
                        max_stock: { type: 'number', minimum: 0, example: 500 },
                        category_id: { type: 'integer', nullable: true, example: 3 },
                        stock_type_id: { type: 'integer', nullable: true, example: 1 },
                        manufacturer_id: { type: 'integer', nullable: true, example: 5 },
                        tax_rule_id: { type: 'integer', nullable: true, example: 2 },
                        measure_id: { type: 'integer', nullable: true, example: 1 },
                        image_base64: { type: 'string', nullable: true, description: 'Imagem em base64 para atualizar', example: null },
                        image_url: { type: 'string', nullable: true, description: 'URL da imagem existente', example: null }
                    }
                },
                BulkUpdateProductsRequest: {
                    type: 'object',
                    required: ['productIds'],
                    properties: {
                        productIds: {
                            type: 'array',
                            items: { type: 'string', format: 'uuid' },
                            example: ['550e8400-e29b-41d4-a716-446655440000']
                        },
                        category_id: { type: 'integer', nullable: true, example: 3 },
                        stock_type_id: { type: 'integer', nullable: true, example: 1 },
                        manufacturer_id: { type: 'integer', nullable: true, example: 5 },
                        tax_rule_id: { type: 'integer', nullable: true, example: 2 },
                        measure_id: { type: 'integer', nullable: true, example: 1 },
                        selling_price: { type: 'number', minimum: 0, example: 8.99 },
                        cost_price: { type: 'number', minimum: 0, example: 5.50 },
                        min_stock: { type: 'number', minimum: 0, example: 10 },
                        max_stock: { type: 'number', minimum: 0, example: 500 }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: routeDocPaths
});

export default swaggerSpec;
