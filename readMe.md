# Ground Commerce Platform

The project now contains a working commerce foundation alongside the visual prototype.

## Deployment

- [Step-by-step cPanel deployment guide](./CPANEL_DEPLOYMENT.md) for a live Linux
  cPanel host.
- [Standalone Linux/Docker deployment guide](./DEPLOY.md) for a VPS that
  supports Docker Compose.

## Run The Backend Locally

These are local-development steps. For a live cPanel server, follow the
[cPanel deployment guide](./CPANEL_DEPLOYMENT.md); do not use the development
schema-push command on a production database.

1. Install MySQL 8 or newer and create a database named `ground`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. Install packages with `npm install`.
4. Generate Prisma Client with `npm run db:generate`.
5. Apply the schema with `npm run db:migrate`.
6. Seed the development catalog with `npm run db:seed`.
7. Start the API with `npm run dev`.

Run the focused automated checks with `npm test`.

The API listens on `http://localhost:4000` by default.

### Initial API Surface

- `GET /health` verifies API and database connectivity.
- `POST /api/v1/auth/register` creates a customer account with a bcrypt password hash.
- `POST /api/v1/auth/login` returns a short-lived JWT.
- `POST /api/v1/auth/forgot-password` creates a hashed, expiring password reset token.
- `POST /api/v1/auth/reset-password` consumes a reset token once and updates the bcrypt password hash.
- `POST /api/v1/auth/verify-email` consumes an expiring email verification token.
- `POST /api/v1/auth/change-password` changes a password only after verifying the current bcrypt hash.

New registrations remain `PENDING` and do not receive an authenticated JWT until email verification is completed.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM`, and `APP_URL` to send verification emails. In local development without SMTP configuration, new accounts are activated immediately so the storefront remains usable.
- `GET /api/v1/products` supports search, category, status, pagination, and SKU matching.
- `POST /api/v1/products` creates a product, image records, inventory, an initial movement, and an audit log. It requires an admin or staff bearer token.
- `GET /api/v1/orders` returns the authenticated customer’s orders, or all orders for staff/admin users.
- `POST /api/v1/orders` creates an order from product IDs and quantities, revalidates server-side prices and stock, reserves inventory transactionally, and creates a pending payment record.
- Checkout normalizes duplicate product lines, validates shipping-address ownership, and generates collision-resistant order numbers.
- `PATCH /api/v1/orders/:orderNumber/status` lets staff/admin users update fulfillment status and records an audit event.
- `POST /api/v1/orders/:orderNumber/cancel` cancels eligible orders and transactionally releases reserved inventory.
- `POST /api/v1/payments/initialize` initializes a pending payment through Paystack.
- `POST /api/v1/payments/paystack/webhook` processes Paystack callbacks idempotently using a unique provider event ID.
- `POST /api/v1/payments/:paymentId/refund` starts a provider-backed refund for staff/admin users.
- `GET /api/v1/cart` returns the authenticated user’s cart.
- `POST /api/v1/cart/items` adds an item after checking the server-side inventory quantity.
- `PATCH /api/v1/cart/items/:itemId` updates quantity with availability validation.
- `DELETE /api/v1/cart/items/:itemId` removes a cart item.
- `GET /api/v1/wishlist`, `POST /api/v1/wishlist/:productId`, and `DELETE /api/v1/wishlist/:productId` manage authenticated wishlist items.
- `GET /api/v1/addresses`, `POST /api/v1/addresses`, `PATCH /api/v1/addresses/:addressId`, and `DELETE /api/v1/addresses/:addressId` manage authenticated customer addresses with default-address handling.
- `GET /api/v1/reviews/product/:productId` returns approved product reviews.
- `POST /api/v1/reviews/product/:productId` allows verified purchasers to submit a review.
- `GET /api/v1/reviews/moderation` and `PATCH /api/v1/reviews/:reviewId/status` provide staff/admin moderation controls.
- `POST /api/v1/coupons` and `GET /api/v1/coupons` provide staff/admin coupon management.
- `POST /api/v1/coupons/validate` validates a coupon against the authenticated customer, order subtotal, shipping, date window, usage limits, and discount cap.
- `GET /api/v1/shipping/methods` lists active shipping methods.
- `POST /api/v1/shipping/quote` calculates destination and weight-based shipping rates.
- `POST /api/v1/taxes/quote` calculates the configured tax amount for a country and subtotal.
- `GET /api/v1/users/me` returns the authenticated profile without exposing password data.
- `GET /api/v1/users` provides protected staff/admin customer and user search.
- `PATCH /api/v1/users/:userId/status` manages user lifecycle status for admins.
- `PATCH /api/v1/users/:userId/role` manages staff/customer roles with self-demotion protection.
- `GET /api/v1/analytics/dashboard` returns date-filtered revenue, order, customer, catalog, inventory, average-order, and top-product metrics for staff/admin users.
- `GET /api/v1/audit-logs` returns filtered administrative audit history for admins.
- `GET /api/v1/notifications` returns in-app notifications for the authenticated user.
- `PATCH /api/v1/notifications/:notificationId/read` and `PATCH /api/v1/notifications/read-all` manage read state.
- `GET/PATCH /api/v1/notifications/preferences` manages notification preferences.
- `GET /api/v1/refunds` lists refund requests for customers or staff/admin users.
- `POST /api/v1/refunds` lets customers request refunds for delivered or returned paid orders.
- `PATCH /api/v1/refunds/:refundId/status` lets staff/admin users process refund lifecycle changes.
- `GET /api/v1/catalog/categories` and `GET /api/v1/catalog/brands` provide public catalog taxonomy reads.
- `POST/PATCH/DELETE /api/v1/catalog/categories` provides protected hierarchical category management.
- `POST/PATCH /api/v1/catalog/brands` provides protected brand management.
- `POST /api/v1/media/upload` accepts up to 12 image files and returns object URLs; files are stored outside PostgreSQL in the local `uploads/` adapter.
- `GET/PATCH /api/v1/settings` provides authenticated admin settings for store status, low-stock alerts, store identity, support email, currency, payment provider, delivery defaults, free-shipping threshold, and tax quoting.

The admin product editor accepts up to 12 JPEG, PNG, WebP, or GIF files per product. The local adapter is suitable for development; production deployments should replace it with the S3/Cloudinary storage adapter and persist only returned object URLs.
- `PATCH /api/v1/products/:productId` updates product content, media, pricing, status, and inventory with an adjustment movement.
- `DELETE /api/v1/products/:productId` archives a product without destroying order history.
- `POST/PATCH /api/v1/products/:productId/variants` manages product variants and variant inventory.
- `GET /api-docs.json` exposes the current OpenAPI 3 API document.

Authentication routes are rate-limited to 20 requests per 15 minutes per IP, and payment routes are rate-limited to 60 requests per minute per IP.

Paystack is the only supported payment provider. Configure its secret with `PAYSTACK_SECRET_KEY`; without it, the adapter stays in local mode and does not contact the external gateway.

Webhook callbacks must include a valid HMAC signature in `x-paystack-signature`, `x-webhook-signature`, or `x-signature`. Unsigned callbacks are rejected before payment or order state changes.

When `PAYSTACK_SECRET_KEY` is present, the Paystack adapter calls Paystack’s initialize, verify, and refund endpoints.

The browser storefront and admin dashboard remain available through `index.html` and `admin.html`. Their current local catalog is now designed to map to the API product contract; the next frontend step is replacing local storage reads with authenticated API queries.

The storefront now loads public products from `GET http://localhost:4000/api/v1/products?take=100` when the API is available, merges them with the curated offline collection, and falls back to the local collection when the API is stopped.

## Architecture Status

Implemented foundation: typed Node/Express API, Prisma/MySQL schema, JWT authentication, bcrypt password hashing, role checks, Zod request validation, Helmet/CORS middleware, product search, inventory initialization, audit logging, Docker services, and seed data.

Remaining improvements: customer accounts, returns/refunds, notifications, background jobs, and automated API tests.

---

Below is the original comprehensive **master prompt/blueprint** for the end-to-end platform.

 # MASTER BUILD PROMPT: MODERN MULTI-ROLE E-COMMERCE PLATFORM

 ## 1\. ROLE

 You are a senior full-stack software architect, UI/UX designer, security engineer, DevOps engineer, and QA engineer.

 Build a **production-ready, modern, scalable e-commerce web application** from the ground up.

 The application must support:

 - Customers
- Administrators
- Staff/team members
- Product/catalog management
- Inventory management
- Shopping cart
- Checkout
- Multiple payment providers
- Orders and fulfillment
- Customer management
- User management
- Promotions and coupons
- Reviews and ratings
- Notifications
- Analytics and reporting
- Audit logs
- Settings
- Role-based access control
- Secure authentication
- Responsive modern UI
- API integrations
- Payment webhooks
- Error handling
- Testing
- Deployment readiness

 Do not build a toy/demo application. Treat this as a **real commercial e-commerce platform** that could eventually serve thousands or millions of users.

---

 # 2\. PRODUCT VISION

 Create a polished e-commerce platform where customers can:

 1. Browse products.
2. Search and filter products.
3. View detailed product information.
4. Select product variants.
5. Add products to their cart.
6. Save products to a wishlist.
7. Create an account.
8. Manage their profile.
9. Save multiple addresses.
10. Checkout securely.
11. Pay using different payment methods.
12. Track orders.
13. Receive order notifications.
14. Review purchased products.
15. Request returns/refunds where supported.
16. View their complete order history.

 Administrators should have a powerful dashboard where they can:

 1. Manage users.
2. Manage staff.
3. Manage roles and permissions.
4. Manage products.
5. Manage categories.
6. Manage brands.
7. Manage inventory.
8. Manage orders.
9. Manage payments.
10. Manage refunds.
11. Manage coupons.
12. Manage promotions.
13. Manage reviews.
14. Manage customers.
15. Manage shipping.
16. Manage taxes.
17. Manage notifications.
18. View analytics.
19. View audit logs.
20. Configure application settings.

---

 # 3\. TECHNOLOGY REQUIREMENTS

 Use a modern, maintainable architecture.

 Preferred stack:

 ### Frontend

 - Next.js
- React
- TypeScript
- Tailwind CSS
- Modern component system such as shadcn/ui
- React Hook Form
- Zod
- TanStack Query where appropriate
- Accessible semantic HTML
- Responsive design
- Dark/light theme support

 ### Backend

 Use a clean API architecture.

 Preferred:

 - Node.js
- TypeScript
- NestJS or another production-grade TypeScript backend framework
- REST API
- OpenAPI/Swagger documentation
- Background job processing

 ### Database

 Use:

 - PostgreSQL
- Prisma ORM or equivalent production-grade ORM

 Use proper:

 - Foreign keys
- Unique constraints
- Indexes
- Transactions
- Soft deletion where appropriate
- Database migrations

 ### Caching / Queues

 Use Redis for:

 - Caching
- Sessions where appropriate
- Rate limiting
- Background jobs
- Payment processing jobs
- Email jobs
- Notification jobs

 ### File storage

 Design storage abstraction so the system can use:

 - S3-compatible storage
- Cloudinary
- Local development storage

 Product images must never be stored directly inside the database.

---

 # 4\. ARCHITECTURE

 Use a modular architecture.

 Recommended modules:

```
Auth
Users
Roles
Permissions
Customers
Products
Categories
Brands
ProductVariants
Inventory
Cart
Wishlist
Checkout
Orders
Payments
Refunds
Shipping
Taxes
Coupons
Promotions
Reviews
Notifications
Email
Analytics
Reports
AuditLogs
Settings
Media
Search
Admin
```

 Separate business logic from controllers/routes.

 Use:

```
Controller
    ↓
Service
    ↓
Repository / ORM
    ↓
Database
```

 Avoid putting business logic directly inside route handlers.

 Create reusable services and utilities.

---

 # 5\. AUTHENTICATION

 Implement secure authentication.

 Support:

 - Email/password authentication
- Customer registration
- Admin login
- Staff login
- Logout
- Forgot password
- Reset password
- Email verification
- Session management
- Refresh tokens if using token-based authentication
- Account lockout/rate limiting
- Optional 2FA
- Secure password hashing

 Never store plain-text passwords.

 Use a strong password hashing algorithm such as Argon2 or bcrypt.

 Implement:

 - Secure cookies where appropriate
- CSRF protection where applicable
- Rate limiting
- Login attempt protection
- Session invalidation
- Password change
- Password reset token expiration

---

 # 6\. USER MANAGEMENT

 Create a complete user management system.

 User fields should include appropriate fields such as:

```
id
firstName
lastName
email
phone
passwordHash
avatar
status
emailVerified
phoneVerified
lastLoginAt
createdAt
updatedAt
deletedAt
```

 User statuses:

```
ACTIVE
INACTIVE
SUSPENDED
BANNED
PENDING
```

 Admins should be able to:

 - Create users
- Edit users
- View users
- Search users
- Filter users
- Suspend users
- Activate users
- Ban users
- Delete users
- Reset passwords
- Verify users
- View login history
- View customer orders
- View customer payments
- View customer activity

---

 # 7\. ROLES AND PERMISSIONS

 Implement granular RBAC.

 Example roles:

```
SUPER_ADMIN
ADMIN
MANAGER
INVENTORY_MANAGER
ORDER_MANAGER
CUSTOMER_SUPPORT
MARKETING_MANAGER
ACCOUNTANT
CUSTOMER
```

 Permissions should be granular.

 Examples:

```
users.read
users.create
users.update
users.delete

products.read
products.create
products.update
products.delete

orders.read
orders.update
orders.cancel
orders.refund

payments.read
payments.refund

inventory.read
inventory.update

coupons.create
coupons.update
coupons.delete

reports.read
settings.update
```

 Do not rely only on frontend permission checks.

 Every protected backend operation must enforce authorization.

The API now centralizes named permissions such as `products.create`, `products.update`, `products.delete`, `orders.update`, `orders.refund`, `coupons.manage`, `reports.read`, and `users.manage` in the permission middleware.

---

 # 8\. ADMIN DASHBOARD

 Create a premium admin dashboard.

 Dashboard should show:

 - Total revenue
- Revenue today
- Revenue this week
- Revenue this month
- Total orders
- Pending orders
- Completed orders
- Cancelled orders
- Total customers
- New customers
- Total products
- Low-stock products
- Out-of-stock products
- Conversion rate
- Average order value
- Refund amount

 Charts:

 - Revenue over time
- Orders over time
- Customer growth
- Top products
- Sales by category
- Sales by payment method
- Sales by location

 Include date filters:

```
Today
Yesterday
Last 7 days
Last 30 days
This month
Last month
This year
Custom range
```

---

 # 9\. PRODUCT MANAGEMENT

 Create complete product management.

 Products should support:

```
id
name
slug
SKU
description
shortDescription
price
compareAtPrice
costPrice
category
brand
status
visibility
featured
taxClass
weight
dimensions
metaTitle
metaDescription
createdAt
updatedAt
```

 Product statuses:

```
DRAFT
ACTIVE
ARCHIVED
OUT_OF_STOCK
```

 Support:

 - Product images
- Product galleries
- Product videos
- Product variants
- Product attributes
- Product specifications
- Related products
- Cross-sell products
- Upsell products
- SEO metadata

---

 # 10\. PRODUCT VARIANTS

 Support variants such as:

```
Size
Color
Storage
Material
Capacity
Model
```

 Example:

```
Product: iPhone

Variants:
- 128GB / Black
- 128GB / White
- 256GB / Black
- 256GB / White
```

 Each variant can have:

 - SKU
- Price
- Compare-at price
- Cost
- Inventory
- Weight
- Images
- Status

---

 # 11\. CATEGORIES

 Implement hierarchical categories.

 Example:

```
Electronics
 ├── Phones
 │    ├── Android
 │    └── iPhone
 ├── Computers
 └── Accessories
```

 Support:

 - Category images
- Category descriptions
- Parent categories
- SEO metadata
- Sort order
- Active/inactive state

---

 # 12\. BRANDS

 Implement brand management.

 Fields:

```
name
slug
logo
description
website
status
SEO metadata
```

---

 # 13\. INVENTORY

 Create robust inventory management.

 Track:

 - Available quantity
- Reserved quantity
- Sold quantity
- Damaged quantity
- Returned quantity
- Reorder threshold

 Inventory movements:

```
PURCHASE
SALE
RETURN
ADJUSTMENT
DAMAGE
TRANSFER
RESTOCK
```

 Maintain an immutable inventory movement history.

 Implement low-stock alerts.

 Prevent overselling through transactional inventory reservation.

---

 # 14\. SHOPPING CART

 Support:

 - Guest cart
- Authenticated cart
- Add item
- Remove item
- Update quantity
- Product variant selection
- Apply coupon
- Calculate subtotal
- Calculate discount
- Calculate tax
- Calculate shipping
- Calculate total

 When a guest logs in, merge the guest cart into the customer's cart.

 Validate product price and availability on the server during checkout.

 Never trust prices sent from the frontend.

---

 # 15\. WISHLIST

 Customers can:

 - Add products
- Remove products
- View wishlist
- Move wishlist items to cart

 Prevent duplicate wishlist items.

---

 # 16\. SEARCH

 Implement powerful product search.

 Support:

 - Keyword search
- SKU search
- Category filtering
- Brand filtering
- Price filtering
- Rating filtering
- Availability filtering
- Attribute filtering
- Sorting

 Sort options:

```
Relevance
Newest
Price low → high
Price high → low
Best selling
Highest rated
```

 Design the search layer so Elasticsearch/OpenSearch/Meilisearch can be introduced later.

---

 # 17\. PRODUCT DETAILS PAGE

 Create a high-quality product page.

 Include:

 - Product gallery
- Product title
- Rating
- Reviews count
- Price
- Discount
- Variant selectors
- Stock status
- Quantity selector
- Add to cart
- Buy now
- Wishlist
- Product description
- Specifications
- Shipping information
- Returns information
- Reviews
- Related products

 Use optimized image loading.

---

 # 18\. CHECKOUT

 Create a secure multi-step or single-page checkout.

 Steps:

```
Cart
↓
Customer Information
↓
Shipping Address
↓
Delivery Method
↓
Payment Method
↓
Order Review
↓
Payment
↓
Order Confirmation
```

 Calculate all totals server-side.

 Checkout must handle:

 - Product availability
- Inventory reservation
- Coupons
- Taxes
- Shipping fees
- Discounts
- Payment fees where applicable
- Currency
- Customer address
- Order creation

---

 # 19\. PAYMENT SYSTEM

 Design a provider-agnostic payment architecture.

 Implement a common interface:

```
interface PaymentProvider {
  initializePayment(...)
  verifyPayment(...)
  refundPayment(...)
  handleWebhook(...)
}
```

 Paystack is the only supported payment provider. Keep payment initialization,
 verification, webhooks, and refunds isolated behind its adapter; do not expose
 alternate gateways in checkout or admin settings.

---

 # 20\. PAYSTACK

 Implement Paystack integration.

 Support:

 - Payment initialization
- Payment verification
- Transaction references
- Webhooks
- Successful payments
- Failed payments
- Abandoned payments
- Refunds where supported

 Never mark an order as paid merely because the frontend reports success.

 Verify payment server-side.

 Validate webhook signatures.

 Use idempotency to prevent duplicate payment processing.

---

 # 23\. CREDIT/DEBIT CARDS

 Do not store raw card information.

 Use a PCI-compliant payment provider/tokenization system.

 The application should never store:

```
Full card number
CVV
Card PIN
```

 Store only safe payment metadata such as:

```
provider
transactionReference
last4
cardBrand
currency
amount
status
```

---

 # 24\. PAYMENT STATES

 Implement explicit payment states:

```
PENDING
PROCESSING
SUCCESS
FAILED
CANCELLED
EXPIRED
REFUNDED
PARTIALLY_REFUNDED
```

 Payment records should contain:

```
id
orderId
provider
providerTransactionId
reference
amount
currency
status
paymentMethod
metadata
paidAt
createdAt
updatedAt
```

 Implement idempotency.

 The same webhook received multiple times must not create duplicate payments or duplicate orders.

---

 # 25\. ORDER MANAGEMENT

 Orders should have statuses such as:

```
PENDING
CONFIRMED
PROCESSING
PACKED
SHIPPED
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
RETURN_REQUESTED
RETURNED
REFUNDED
```

 Order details:

```
orderNumber
customer
items
subtotal
discount
tax
shipping
total
currency
paymentStatus
orderStatus
shippingAddress
billingAddress
notes
createdAt
updatedAt
```

 Administrators should be able to:

 - View orders
- Search orders
- Filter orders
- Update order status
- Cancel orders
- Add notes
- Print invoices
- Print packing slips
- View payment information
- View customer information
- Process refunds

---

 # 26\. ORDER NUMBER

 Generate human-readable order numbers.

 Example:

```
ORD-20260909-000123
```

 Order numbers must be unique.

---

 # 27\. SHIPPING

 Create a shipping system that supports:

 - Shipping zones
- Shipping methods
- Shipping rates
- Free shipping
- Flat-rate shipping
- Weight-based shipping
- Location-based shipping
- Estimated delivery dates
- Tracking numbers

 Example:

```
Standard Delivery
Express Delivery
Pickup
```

 Make shipping provider integration extensible.

---

 # 28\. CUSTOMER ACCOUNT

 Create a customer dashboard.

 Sections:

```
Overview
Orders
Order Details
Wishlist
Addresses
Profile
Security
Payment Methods
Notifications
Reviews
Returns
```

 Dashboard should display:

 - Recent orders
- Order statuses
- Total orders
- Wishlist count
- Account information

---

 # 29\. ADDRESS MANAGEMENT

 Customers can manage:

 - Billing addresses
- Shipping addresses
- Multiple addresses
- Default shipping address
- Default billing address

 Address fields:

```
fullName
phone
country
region/state
city
district
addressLine1
addressLine2
postalCode
deliveryInstructions
```

---

 # 30\. COUPONS

 Implement coupons.

 Coupon types:

```
PERCENTAGE
FIXED_AMOUNT
FREE_SHIPPING
```

 Support:

 - Minimum order value
- Maximum discount
- Start date
- Expiration date
- Usage limit
- Per-user usage limit
- Product restrictions
- Category restrictions
- Customer restrictions
- Active/inactive status

 Prevent coupon abuse server-side.

---

 # 31\. PROMOTIONS

 Create promotional campaigns.

 Support:

 - Flash sales
- Percentage discounts
- Fixed discounts
- Buy X Get Y
- Bundle discounts
- Category discounts
- Product discounts
- Free shipping promotions

 Promotion rules must be calculated server-side.

---

 # 32\. REVIEWS AND RATINGS

 Customers should be able to review products they purchased.

 Support:

 - 1–5 star rating
- Review text
- Images
- Verified purchase badge
- Moderation
- Review status

 Statuses:

```
PENDING
APPROVED
REJECTED
FLAGGED
```

 Admins can moderate reviews.

---

 # 33\. RETURNS AND REFUNDS

 Implement a return/refund workflow.

 Customer can:

 1. Select order.
2. Select item.
3. Choose reason.
4. Add comments/photos.
5. Submit request.

 Admin can:

 - Approve request
- Reject request
- Request additional information
- Mark item received
- Issue refund

 Refund statuses:

```
REQUESTED
APPROVED
PROCESSING
COMPLETED
FAILED
REJECTED
```

 Refund logic must update payment and order records consistently.

---

 # 34\. NOTIFICATIONS

 Implement notification infrastructure.

 Channels:

 - Email
- In-app notifications
- SMS where configured
- Push notifications where supported

 Events:

```
Account created
Email verified
Password reset
Order placed
Payment successful
Payment failed
Order shipped
Order delivered
Refund issued
Low stock
Promotion
```

 Create a notification preference system.

 Customers should control which notifications they receive where appropriate.

---

 # 35\. EMAIL SYSTEM

 Create reusable email templates.

 Templates:

 - Welcome email
- Email verification
- Password reset
- Order confirmation
- Payment confirmation
- Payment failure
- Shipment notification
- Delivery notification
- Refund notification
- Account notification

 Use a background job queue for email sending.

 Do not make checkout depend on synchronous email delivery.

---

 # 36\. ADMIN CUSTOMER MANAGEMENT

 Admin customer page should include:

 - Customer profile
- Contact details
- Registration date
- Last login
- Total orders
- Total spending
- Average order value
- Recent activity
- Order history
- Refund history
- Reviews
- Addresses
- Account status

---

 # 37\. ANALYTICS

 Create analytics dashboards.

 Metrics:

 - Revenue
- Orders
- Customers
- Average order value
- Conversion rate
- Cart abandonment
- Top products
- Top categories
- Top customers
- Refund rate
- Payment success rate
- Sales by country
- Sales by region
- Sales by payment provider

 Allow date filtering and CSV export.

---

 # 38\. REPORTING

 Create downloadable reports.

 Reports:

 - Sales report
- Orders report
- Customer report
- Inventory report
- Product performance
- Payment report
- Refund report
- Tax report

 Support CSV and PDF where appropriate.

 Large reports should be generated asynchronously.

---

 # 39\. AUDIT LOGS

 Create immutable audit logs.

 Record:

```
user
action
resource
resourceId
previousValue
newValue
IP address
user agent
timestamp
```

 Examples:

```
Admin created product
Admin changed product price
Admin deleted category
Admin refunded order
Admin suspended user
Staff changed order status
```

 Never expose sensitive secrets in audit logs.

---

 # 40\. SECURITY

 Apply strong security practices.

 Implement:

 - Input validation
- Output encoding
- SQL injection protection
- XSS protection
- CSRF protection where applicable
- Authentication
- Authorization
- Rate limiting
- Secure cookies
- Password hashing
- Session expiration
- API throttling
- Request validation
- File upload validation
- MIME validation
- Image size limits
- Webhook signature verification
- Payment idempotency
- Secure headers
- CORS configuration
- Secrets through environment variables

 Never expose:

```
DATABASE_PASSWORD
PAYMENT_SECRET_KEYS
JWT_SECRET
API_SECRET_KEYS
```

 to the frontend.

---

 # 41\. FRAUD PREVENTION

 Design basic fraud controls.

 Track:

 - Payment attempts
- Failed payment attempts
- IP address
- Device information where appropriate
- Suspicious order frequency
- Multiple failed payments
- Abnormally high order values

 Allow administrators to flag suspicious orders.

 Do not automatically block legitimate customers without configurable rules.

---

 # 42\. ADMIN UI

 Admin interface should have:

 ### Sidebar

```
Dashboard
Orders
Products
Categories
Brands
Inventory
Customers
Users
Roles & Permissions
Payments
Refunds
Coupons
Promotions
Reviews
Shipping
Reports
Analytics
Notifications
Audit Logs
Settings
```

 Create responsive tables with:

 - Search
- Filters
- Sorting
- Pagination
- Bulk actions
- Export

 Use confirmation dialogs for destructive actions.

---

 # 43\. CUSTOMER UI

 Build a polished storefront.

 Pages:

```
Home
Shop
Category
Product
Search
Cart
Checkout
Order Success
Order Tracking
Login
Register
Forgot Password
Customer Dashboard
Orders
Wishlist
Profile
Addresses
Reviews
```

 Use modern e-commerce design principles.

 The UI should feel premium, fast, clean, and trustworthy.

---

 # 44\. HOMEPAGE

 Homepage should support configurable sections:

```
Hero banner
Featured categories
Featured products
Best sellers
New arrivals
Flash sale
Promotions
Brands
Testimonials
Newsletter
Footer
```

 Admin should be able to configure homepage content.

---

 # 45. SEO

 Implement:

 - Dynamic metadata
- SEO-friendly URLs
- Product structured data
- Breadcrumb structured data
- Canonical URLs
- Sitemap
- Robots.txt
- Open Graph metadata
- Twitter/X cards
- Optimized product titles
- Meta descriptions

 Use:

```
/products/iphone-15-pro
/category/smartphones
```

 instead of database IDs.

---

 # 46. PERFORMANCE

 Optimize for excellent Core Web Vitals.

 Use:

 - Image optimization
- Lazy loading
- Code splitting
- Server-side rendering where beneficial
- Caching
- Database indexes
- Pagination
- Efficient queries
- Background jobs
- CDN support

 Avoid N+1 queries.

 Do not load thousands of products into the browser.

---

 # 47\. ACCESSIBILITY

 Follow WCAG principles.

 Implement:

 - Keyboard navigation
- Proper labels
- ARIA only where necessary
- Visible focus states
- Color contrast
- Screen-reader-friendly controls
- Accessible dialogs
- Accessible forms
- Error messages

---

 # 48\. INTERNATIONALIZATION

 Design the system to support multiple:

 - Languages
- Currencies
- Countries
- Tax systems
- Payment providers

 At minimum, architect the database so these can be added without rewriting the application.

---

 # 49\. MULTI-CURRENCY

 Products and orders should support currencies.

 Do not blindly convert historical order amounts.

 An order must preserve the currency and amounts that existed when the order was placed.

 Example:

```
USD
GHS
KES
NGN
EUR
GBP
```

 Currency conversion should be configurable.

---

 # 50\. DATABASE MODEL

 Create a properly normalized relational database.

 At minimum consider models such as:

```
User
Role
Permission
RolePermission
UserRole
CustomerProfile

Product
ProductVariant
ProductImage
ProductAttribute
ProductAttributeValue

Category
Brand

Inventory
InventoryMovement

Cart
CartItem
Wishlist
WishlistItem

Address

Order
OrderItem

Payment
PaymentAttempt
Refund

Coupon
CouponUsage
Promotion
PromotionRule

Review

ShippingZone
ShippingMethod
ShippingRate

Notification
NotificationPreference

AuditLog

Setting

Media
```

 Add timestamps and appropriate indexes.

 Use transactions for critical operations.

---

 # 51\. ORDER TRANSACTION

 The checkout/order creation process must be transactional.

 Conceptually:

```
Validate cart
↓
Validate products
↓
Validate prices
↓
Validate inventory
↓
Validate coupon
↓
Calculate totals
↓
Reserve inventory
↓
Create order
↓
Create payment record
↓
Initialize payment
```

 Handle failures safely.

 Do not leave inventory permanently reserved if payment expires or fails.

 Create mechanisms for reservation expiration/release.

---

 # 52\. PAYMENT WEBHOOK ARCHITECTURE

 Payment webhooks must:

 1. Validate signature.
2. Parse event.
3. Find transaction.
4. Verify transaction where necessary.
5. Check idempotency.
6. Update payment.
7. Update order.
8. Confirm inventory.
9. Trigger notifications.
10. Record audit/event information.

 Webhook processing should be safe if the same event is received multiple times.

---

 # 53\. BACKGROUND JOBS

 Create workers for:

 - Emails
- Notifications
- Payment reconciliation
- Inventory release
- Abandoned cart processing
- Report generation
- Image processing
- Search indexing
- Scheduled promotions
- Analytics aggregation

 Use retries with exponential backoff.

 Failed jobs should be observable.

---

 # 54\. API DESIGN

 Create REST endpoints following consistent conventions.

 Examples:

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/products
POST   /api/products
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id

GET    /api/categories
POST   /api/categories

GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id

POST   /api/checkout

GET    /api/orders
GET    /api/orders/:id

POST   /api/payments/initialize
GET    /api/payments/:id

POST   /api/payments/webhooks/:provider

GET    /api/admin/dashboard
GET    /api/admin/customers
GET    /api/admin/users
```

 Document all APIs using OpenAPI.

---

 # 55\. API RESPONSE FORMAT

 Use a consistent API response structure.

 Success:

```
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

 Error:

```
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

 Never expose stack traces in production.

---

 # 56\. ERROR HANDLING

 Create centralized error handling.

 Handle:

 - Validation errors
- Authentication errors
- Authorization errors
- Not found
- Conflict
- Payment failure
- Inventory failure
- Database errors
- External API failures
- Rate limits

 Return user-friendly messages while logging technical details securely.

---

 # 57. OBSERVABILITY

 Implement:

 - Structured logging
- Error monitoring
- Request IDs
- Payment event logging
- Background job monitoring
- Health checks

 Create:

```
GET /health
GET /health/database
GET /health/redis
```

 Do not expose sensitive infrastructure details publicly.

---

 # 58\. TESTING

 Create comprehensive tests.

 ### Unit tests

 Test:

 - Pricing
- Discounts
- Coupons
- Tax calculation
- Shipping calculation
- Inventory
- Payment adapters
- Order state transitions
- Permissions

 ### Integration tests

 Test:

 - Authentication
- Product creation
- Cart
- Checkout
- Orders
- Payments
- Webhooks
- Refunds

 ### End-to-end tests

 Test complete flows:

```
Register
↓
Login
↓
Browse product
↓
Add to cart
↓
Checkout
↓
Pay
↓
Order confirmation
↓
Admin sees order
↓
Admin changes status
↓
Customer sees updated status
```

 Also test failed payments and webhook retries.

---

 # 59\. SEED DATA

 Create realistic development seed data.

 Include:

 - Admin user
- Staff users
- Customers
- Roles
- Permissions
- Categories
- Brands
- Products
- Product variants
- Inventory
- Coupons
- Promotions
- Sample orders
- Reviews

 Use obvious development-only credentials and clearly document them.

 Never ship production secrets in seed files.

---

 # 60\. ENVIRONMENT VARIABLES

 Create `.env.example`.

 Include placeholders for:

```
DATABASE_URL
REDIS_URL

AUTH_SECRET
JWT_SECRET

APP_URL
API_URL

STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY

PAYSTACK_SECRET_KEY
PAYSTACK_PUBLIC_KEY

EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASSWORD
EMAIL_FROM

SMS_API_KEY

SENTRY_DSN
```

 Never commit actual credentials.

---

 # 61\. PAYMENT PROVIDER CONFIGURATION

 Only Paystack is supported and configured from admin settings.

 Example:

```
Paystack
[Enabled]
```

 Do not expose provider secret keys through the admin frontend.

 Secrets must remain server-side.

---

 # 62\. ADMIN SETTINGS

 Create settings categories:

```
General
Store
Currency
Tax
Shipping
Payments
Email
SMS
Notifications
Security
SEO
Social
Maintenance
```

 Support:

 - Store name
- Logo
- Favicon
- Contact information
- Default currency
- Timezone
- Tax configuration
- Shipping settings
- Payment configuration
- Email configuration

---

 # 63\. MEDIA MANAGEMENT

 Create a media library.

 Support:

 - Upload
- Delete
- Search
- Image preview
- Folder/category organization
- Alt text
- File metadata

 Validate:

 - File type
- File size
- Image dimensions

 Generate optimized image versions where possible.

---

 # 64\. ADMIN PRODUCT EDITOR

 Build a sophisticated product editor.

 Sections:

```
Basic Information
Pricing
Inventory
Images
Variants
Attributes
Shipping
SEO
Related Products
Advanced
```

 Support draft saving.

 Warn before navigating away with unsaved changes.

---

 # 65\. MOBILE EXPERIENCE

 The storefront must be mobile-first.

 Ensure:

 - Mobile navigation
- Sticky cart access
- Touch-friendly controls
- Responsive product grids
- Mobile checkout
- Mobile admin support
- Responsive tables

---

 # 66\. DESIGN SYSTEM

 Create a consistent design system.

 Define:

 - Colors
- Typography
- Spacing
- Border radius
- Shadows
- Buttons
- Inputs
- Selects
- Dialogs
- Tables
- Cards
- Badges
- Alerts
- Toasts
- Loading states
- Empty states

 Use a clean premium visual style.

 Avoid excessive gradients, unnecessary animations, and visual clutter.

---

 # 67\. LOADING STATES

 Every asynchronous operation must have a proper loading state.

 Use:

 - Skeletons
- Spinners
- Progress indicators
- Disabled buttons during submission

 Never allow double submission of:

 - Orders
- Payments
- Refunds
- Product creation
- Destructive actions

---

 # 68\. EMPTY STATES

 Create useful empty states for:

 - Empty cart
- Empty wishlist
- No orders
- No products
- No search results
- No notifications
- No reviews

 Include useful actions where appropriate.

---

 # 69\. ACCESS CONTROL UX

 Hide or disable admin functionality that the current user does not have permission to use.

 However, remember:

 **Frontend hiding is only a UX feature. Backend authorization remains mandatory.**

---

 # 70\. DATA INTEGRITY

 Use database constraints and transactions to protect:

 - Inventory
- Payments
- Orders
- Coupons
- Refunds
- User roles
- Product variants

 Never rely exclusively on application-level checks when a database constraint can enforce integrity.

---

 # 71\. AUDITABILITY

 Every financial action should be traceable.

 For example:

```
Order created
Payment initialized
Payment verified
Payment failed
Refund requested
Refund approved
Refund completed
Inventory reserved
Inventory released
Inventory deducted
```

 Use event records/audit logs where appropriate.

---

 # 72\. ADMIN ORDER DETAIL

 Build a detailed order timeline.

 Example:

```
09:30 Order created
09:31 Payment initialized
09:32 Payment successful
09:32 Order confirmed
10:10 Order processing
14:30 Order shipped
Next day 11:20 Delivered
```

 Show actor/provider where appropriate.

---

 # 73\. CUSTOMER ORDER TRACKING

 Customers should see:

```
Order placed
Payment confirmed
Processing
Packed
Shipped
Out for delivery
Delivered
```

 Use a visual timeline.

---

 # 74\. CART ABANDONMENT

 Track abandoned carts.

 Store:

```
customer
cart items
cart value
createdAt
lastActivityAt
```

 Allow configurable abandoned-cart notifications.

 Respect customer notification preferences and applicable privacy requirements.

---

 # 75\. PRODUCT RECOMMENDATIONS

 Build a recommendation abstraction.

 Initial recommendation strategies:

```
Related products
Same category
Frequently bought together
Recently viewed
Best sellers
```

 Architect it so AI/ML recommendations can be added later.

---

 # 76\. RECENTLY VIEWED

 Track recently viewed products for authenticated users and optionally guests.

 Limit the number stored per customer.

---

 # 77\. ADMIN BULK OPERATIONS

 Support bulk operations for:

 - Products
- Orders
- Users
- Customers
- Reviews
- Inventory

 Examples:

```
Bulk activate
Bulk deactivate
Bulk delete
Bulk export
Bulk update price
Bulk update inventory
Bulk change category
```

 Use confirmation dialogs for destructive operations.

---

 # 78\. IMPORT/EXPORT

 Support CSV imports/exports for:

 - Products
- Customers
- Inventory
- Orders

 Validate imported data before committing changes.

 Provide useful error reports for failed rows.

---

 # 79\. PRIVACY

 Implement privacy-conscious architecture.

 Support:

 - Account deletion
- Data export
- Consent/preferences where applicable
- Privacy policy
- Cookie policy
- Terms and conditions

 Do not collect unnecessary personal information.

---

 # 80\. LEGAL PAGES

 Create:

```
Privacy Policy
Terms & Conditions
Refund Policy
Shipping Policy
Cookie Policy
Contact
```

 Make content configurable from the admin panel.

---

 # 81\. INTERNATIONAL PAYMENT ARCHITECTURE

 The current payment system intentionally supports Paystack only.

 Example:

```
PaymentService
 ├── PaystackAdapter
```

 The order flow uses the common payment interface, but alternate payment
 providers are not currently available.

---

 # 82. PAYMENT RECONCILIATION

 Create an admin payment reconciliation system.

 Allow administrators to see:

```
Internal payment status
Provider payment status
Transaction reference
Amount
Currency
Provider
Created time
Verified time
```

 Provide a mechanism to manually trigger verification for unresolved transactions.

---

 # 83\. CURRENCY AND MONEY HANDLING

 Never use floating-point arithmetic for financial calculations.

 Use integer minor units where appropriate.

 For example:

```
100.50 USD
```

 should internally be represented safely according to the currency's minor-unit rules.

 All calculations must be deterministic and tested.

---

 # 84\. TAX

 Create a tax abstraction.

 Support:

 - Tax rates
- Tax regions
- Tax-inclusive pricing
- Tax-exclusive pricing
- Tax exemptions where appropriate

 Do not hard-code tax rates into product code.

---

 # 85\. SEARCH ENGINE FRIENDLINESS

 Product URLs must use slugs.

 Support:

```
301 redirects
canonical URLs
sitemap generation
structured data
```

 Avoid duplicate product URLs.

---

 # 86\. CODE QUALITY

 Follow:

 - SOLID principles
- DRY
- Separation of concerns
- Type safety
- Strong typing
- Meaningful naming
- Small reusable functions
- Clear module boundaries

 Avoid:

 - Giant components
- Giant service classes
- Duplicated logic
- Hard-coded secrets
- Hard-coded payment logic
- Business logic inside UI components

---

 # 87\. DOCUMENTATION

 Create:

```
README.md
ARCHITECTURE.md
API.md
DATABASE.md
PAYMENTS.md
DEPLOYMENT.md
SECURITY.md
CONTRIBUTING.md
```

 Document:

 - Local setup
- Environment variables
- Database migration
- Seed process
- Running tests
- Payment provider configuration
- Production deployment
- Background workers

---

 # 88\. DOCKER

 Provide Docker support.

 Create:

```
Dockerfile
docker-compose.yml
```

 Development stack should be able to run:

```
Frontend
Backend
PostgreSQL
Redis
Worker
```

---

 # 89\. CI/CD

 Create CI pipeline.

 Run on pull requests:

```
Install
Lint
Type check
Unit tests
Integration tests
Build
```

 Production deployment should require passing checks.

---

 # 90\. PRODUCTION READINESS

 Before declaring the project complete, verify:

 - No TypeScript errors
- No lint errors
- No broken imports
- No unhandled promises
- No exposed secrets
- No insecure endpoints
- No missing authorization checks
- No duplicate payment processing
- No inventory race conditions
- No broken checkout
- No broken mobile layouts
- No major accessibility issues

---

 # 91\. IMPLEMENTATION ORDER

 Build the application in logical phases.

 ### Phase 1

 Foundation:

 - Repository
- Monorepo structure if appropriate
- Database
- Authentication
- Users
- Roles
- Permissions
- Core UI

 ### Phase 2

 Catalog:

 - Products
- Categories
- Brands
- Variants
- Inventory
- Media

 ### Phase 3

 Storefront:

 - Homepage
- Search
- Product pages
- Cart
- Wishlist

 ### Phase 4

 Commerce:

 - Checkout
- Orders
- Shipping
- Taxes
- Coupons

 ### Phase 5

 Payments:

 - Payment abstraction
- Paystack
- Webhooks
- Refunds

 ### Phase 6

 Administration:

 - Dashboard
- Customer management
- User management
- Order management
- Product management
- Inventory
- Reports
- Analytics
- Audit logs

 ### Phase 7

 Advanced:

 - Notifications
- Reviews
- Returns
- Abandoned carts
- Recommendations
- Import/export
- Advanced analytics

 ### Phase 8

 Production:

 - Testing
- Security audit
- Performance optimization
- Docker
- CI/CD
- Documentation
- Monitoring

---

 # 92\. IMPORTANT DEVELOPMENT RULES

 Do not store raw card details not skip foundational architecture.

 Do not create fake payment success flows.

 Do not hard-code payment responses.

 Do not trust frontend prices.

 Do not trust frontend order totals.

 Do not expose secret keys.

 Do not store raw card details.

 Do not mark payments successful without server-side verification.

 Do not process webhooks without idempotency.

 Do not use mock data as a not modify inventory without transactional safeguards.

 Do not put authorization only in the frontend.

 Do not use mock data as a substitute for real business logic once the corresponding feature is implemented.

 If an external integration cannot be configured yet, create a clean adapter/interface and clearly document the missing environment configuration.

---

 # 93\. UI/UX REQUIREMENTS

 The application should look like a modern premium e-commerce platform.

 Design characteristics:

 - Clean
- Minimal
- Professional
- Fast
- Mobile-first
- Strong visual hierarchy
- Excellent typography
- High-quality product presentation
- Clear CTAs
- Accessible
- Consistent spacing
- Subtle animations

 Avoid:

 - Clutter
- Excessive gradients
- Excessive shadows
- Unnecessary popups
- Tiny text
- Poor contrast
- Generic dashboard templates

---

 # 94\. FINAL ACCEPTANCE CRITERIA

 The application is considered complete only when a customer can successfully:

```
Register
↓
Verify email
↓
Login
↓
Browse products
↓
Search/filter
↓
View product
↓
Select variant
↓
Add to cart
↓
Apply coupon
↓
Checkout
↓
Select shipping
↓
Select payment provider
↓
Complete payment
↓
Receive confirmation
↓
View order
↓
Track order
↓
Leave review
```

 And an administrator can:

```
Login
↓
View dashboard
↓
Manage users
↓
Manage roles
↓
Create products
↓
Manage variants
↓
Manage inventory
↓
View orders
↓
Verify payments
↓
Update fulfillment
↓
Process refunds
↓
Manage coupons
↓
Manage promotions
↓
Moderate reviews
↓
View analytics
↓
Generate reports
↓
View audit logs
↓
Configure settings
```

---

 # 95\. DELIVERABLES

 Produce:

 1. Complete source code.
2. Database schema.
3. Database migrations.
4. Seed scripts.
5. REST API.
6. OpenAPI documentation.
7. Customer storefront.
8. Admin dashboard.
9. Authentication system.
10. RBAC system.
11. Product/catalog system.
12. Inventory system.
13. Cart and wishlist.
14. Checkout.
15. Payment abstraction.
16. Paystack integration.
17. Paystack card and mobile-money payment methods.
18. Payment webhooks.
19. Refund system.
20. Order management.
21. Shipping.
22. Tax system.
25. Coupons.
26. Promotions.
27. Reviews.
28. Notifications.
29. Email templates.
30. Analytics.
31. Reports.
32. Audit logs.
33. Security controls.
34. Automated tests.
35. Docker configuration.
36. CI/CD configuration.
37. Environment example.
38. Complete documentation.

---

 # 96\. FINAL INSTRUCTION TO THE AI CODING AGENT

 Do not simply generate a visual prototype.

 Build the actual application architecture and functional implementation.

 Before writing code:

 1. Analyze the requirements.
2. Identify dependencies.
3. Design the architecture.
4. Design the database schema.
5. Define modules.
6. Define API contracts.
7. Define authentication and authorization.
8. Define payment abstraction.
9. Define order and inventory state machines.
10. Define background jobs.
11. Define testing strategy.

 Then implement the system incrementally.

 After each major module:

 1. Run type checking.
2. Run linting.
3. Run relevant tests.
4. Fix errors.
5. Verify database migrations.
6. Verify API contracts.
7. Verify authorization.
8. Verify responsive UI.

 At the end, perform a complete end-to-end audit.

 Prioritize **security, correctness, data integrity, payment reliability, scalability, maintainability, accessibility, and excellent UX** over simply producing a large amount of code.

 The result should be a **production-grade e-commerce platform**, not a mockup.

 This prompt is intentionally stack-agnostic in a few areas so you can adapt it to your preferred infrastructure. If you're using an AI builder such as Cursor, Claude Code, Lovable, Bolt, Replit, or a similar agent, I can also turn this into a **tool-specific build prompt with the exact folder structure, PostgreSQL/Prisma schema, API contracts, UI pages, and implementation sequence**.