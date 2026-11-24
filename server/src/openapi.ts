export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Ground Commerce API', version: '0.1.0', description: 'Commerce, catalog, checkout, payments, and operations API.' },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/health': { get: { summary: 'Check API health', responses: { '200': { description: 'Healthy' } } } },
    '/api/v1/auth/register': { post: { summary: 'Register a customer', responses: { '201': { description: 'Created' }, '400': { description: 'Validation failed' } } } },
    '/api/v1/auth/login': { post: { summary: 'Authenticate a user', responses: { '200': { description: 'JWT issued' }, '401': { description: 'Invalid credentials' } } } },
    '/api/v1/products': { get: { summary: 'Search products', responses: { '200': { description: 'Product collection' } } }, post: { summary: 'Create a product', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' }, '403': { description: 'Forbidden' } } } },
    '/api/v1/orders': { get: { summary: 'List orders', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Order collection' } } }, post: { summary: 'Create an order', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' }, '409': { description: 'Inventory conflict' } } } },
    '/api/v1/payments/initialize': { post: { summary: 'Initialize a provider payment', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Payment initialized' } } } },
    '/api/v1/cart': { get: { summary: 'Get authenticated cart', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Cart' } } } },
    '/api/v1/coupons/validate': { post: { summary: 'Validate a coupon', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Discount quote' } } } },
    '/api/v1/shipping/quote': { post: { summary: 'Calculate shipping', responses: { '200': { description: 'Shipping quote' } } } },
    '/api/v1/taxes/quote': { post: { summary: 'Calculate tax', responses: { '200': { description: 'Tax quote' } } } },
    '/api/v1/analytics/dashboard': { get: { summary: 'Get dashboard metrics', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Metrics' } } } }
  }
} as const;
