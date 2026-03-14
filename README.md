# KUDZNED Backend

A digital marketplace platform for financial products built with NestJS, PostgreSQL, and Redis.

## Features

- **User Management**: Registration, authentication, profile management, KYC verification
- **Wallet System**: Bitcoin wallet integration, deposits, balance management
- **Product Catalog**: Digital product management, categories, search and filtering
- **Order Processing**: Shopping cart, order creation, payment processing, digital fulfillment
- **Real-time Notifications**: WebSocket notifications, email notifications
- **File Management**: Digital file upload, secure download links
- **Security**: JWT authentication, 2FA, role-based access control

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Cache/Queue**: Redis with Bull
- **Authentication**: JWT with Passport
- **File Upload**: Multer
- **Real-time**: Socket.IO
- **Validation**: class-validator
- **Documentation**: Swagger (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kudzned-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the database and Redis:
```bash
docker-compose up postgres redis -d
```

5. Run database migrations:
```bash
npm run migration:run
```

6. Start the development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`

### Docker Deployment

1. Build and start all services:
```bash
docker-compose up --build
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/enable-2fa` - Enable 2FA
- `GET /api/v1/auth/me` - Get current user

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `POST /api/v1/users/change-password` - Change password

### Wallets
- `GET /api/v1/wallets` - Get wallet info
- `GET /api/v1/wallets/balance` - Get balance
- `POST /api/v1/wallets/topup` - Create deposit address
- `GET /api/v1/wallets/transactions` - Get transaction history

### Products
- `GET /api/v1/products` - List products
- `GET /api/v1/products/:id` - Get product details
- `POST /api/v1/products` - Create product (vendors)
- `GET /api/v1/products/categories` - List categories

### Orders
- `GET /api/v1/orders` - Get user orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders/:id` - Get order details
- `GET /api/v1/orders/:id/download/:fileId` - Download file

### Cart
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/cart/items` - Add to cart
- `DELETE /api/v1/cart/items/:id` - Remove from cart

### Notifications
- `GET /api/v1/notifications` - Get notifications
- `POST /api/v1/notifications/:id/read` - Mark as read
- `GET /api/v1/notifications/unread/count` - Get unread count

### Media
- `POST /api/v1/media/upload/product-image` - Upload product image
- `POST /api/v1/media/upload/digital-file` - Upload digital file
- `GET /api/v1/media/files/:path` - Get file

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: User accounts with authentication and profile data
- **Wallets**: Bitcoin wallets with balance tracking
- **Products**: Digital products with categories and metadata
- **Orders**: Purchase orders with items and fulfillment
- **Transactions**: Wallet transaction history
- **Notifications**: User notifications and preferences

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Two-factor authentication (TOTP)
- Role-based access control
- Rate limiting
- Input validation and sanitization
- Secure file upload handling

## Development

### Running Tests
```bash
npm run test
npm run test:e2e
npm run test:cov
```

### Database Operations
```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Code Quality
```bash
npm run lint
npm run format
```

## Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `BTC_API_KEY` - Bitcoin API credentials
- `EMAIL_API_KEY` - Email service credentials

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.