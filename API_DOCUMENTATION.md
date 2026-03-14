# KUDZNED Backend API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Response Format
All API responses follow this format:
```json
{
  "data": {},
  "message": "Success message",
  "statusCode": 200
}
```

Error responses:
```json
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Authentication Endpoints

### Register User
```http
POST /auth/register
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer",
    "kyc_status": "not_started",
    "two_factor_enabled": false
  }
}
```

### Login
```http
POST /auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Enable 2FA
```http
POST /auth/enable-2fa
Authorization: Bearer <token>
```

**Response:**
```json
{
  "secret": "base32_secret",
  "qr_code": "otpauth://totp/KUDZNED..."
}
```

### Verify 2FA
```http
POST /auth/verify-2fa
Authorization: Bearer <token>
```

**Body:**
```json
{
  "token": "123456"
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

---

## User Management

### Get Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /users/profile
Authorization: Bearer <token>
```

**Body:**
```json
{
  "username": "newusername",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890"
}
```

### Change Password
```http
POST /users/change-password
Authorization: Bearer <token>
```

**Body:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass123!"
}
```

---

## Wallet Management

### Get Wallet Info
```http
GET /wallets
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "balance": 1000000,
  "available_balance": 1000000,
  "total_deposited": 1000000,
  "total_withdrawn": 0,
  "btc_addresses": [...]
}
```

### Get Balance
```http
GET /wallets/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "balance": 1000000,
  "available_balance": 1000000,
  "total_deposited": 1000000,
  "total_withdrawn": 0
}
```

### Create Deposit Address
```http
POST /wallets/topup
Authorization: Bearer <token>
```

**Body (optional):**
```json
{
  "amount": 1000000
}
```

**Response:**
```json
{
  "address": "2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp",
  "amount_requested": 1000000,
  "expires_at": "2024-01-02T00:00:00.000Z"
}
```

### Get Transaction History
```http
GET /wallets/transactions?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "deposit",
      "amount": 1000000,
      "status": "confirmed",
      "description": "BTC deposit abc123...",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

---

## Product Management

### List Products
```http
GET /products?page=1&limit=20&search=ebook&category_id=uuid&min_price=1000&max_price=10000
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search term
- `category_id` (optional): Filter by category
- `min_price` (optional): Minimum price in satoshis
- `max_price` (optional): Maximum price in satoshis
- `tags` (optional): Filter by tags
- `sort_by` (optional): Sort field (default: created_at)
- `sort_order` (optional): ASC or DESC (default: DESC)

**Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "title": "Amazing E-book",
      "description": "A great digital book",
      "price": 50000,
      "images": ["url1", "url2"],
      "tags": ["ebook", "fiction"],
      "status": "active",
      "rating": 4.5,
      "total_sales": 100,
      "category": {
        "id": "uuid",
        "name": "E-books",
        "slug": "e-books"
      },
      "vendor": {
        "id": "uuid",
        "username": "vendor1"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Get Product Details
```http
GET /products/:id
```

### Get Featured Products
```http
GET /products/featured?limit=10
```

### Get Categories
```http
GET /products/categories
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "E-books",
    "slug": "e-books",
    "description": "Digital books and publications",
    "image_url": null,
    "is_active": true
  }
]
```

### Create Product (Vendors/Admins only)
```http
POST /products
Authorization: Bearer <token>
```

**Body:**
```json
{
  "title": "My Digital Product",
  "description": "A great digital product",
  "category_id": "uuid",
  "price": 50000,
  "images": ["url1", "url2"],
  "tags": ["tag1", "tag2"],
  "status": "draft"
}
```

### Update Product (Vendors/Admins only)
```http
PUT /products/:id
Authorization: Bearer <token>
```

### Get My Products (Vendors only)
```http
GET /products/my-products?page=1&limit=20
Authorization: Bearer <token>
```

---

## Order Management

### Get Orders
```http
GET /orders?page=1&limit=20&status=completed
Authorization: Bearer <token>
```

**Response:**
```json
{
  "orders": [
    {
      "id": "uuid",
      "total_amount": 100000,
      "status": "completed",
      "payment_status": "paid",
      "fulfillment_status": "fulfilled",
      "created_at": "2024-01-01T00:00:00.000Z",
      "items": [
        {
          "id": "uuid",
          "quantity": 1,
          "unit_price": 100000,
          "total_price": 100000,
          "product": {
            "id": "uuid",
            "title": "Product Name"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "pages": 1
  }
}
```

### Get Order Details
```http
GET /orders/:id
Authorization: Bearer <token>
```

### Create Order
```http
POST /orders
Authorization: Bearer <token>
```

**Body:**
```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 1
    }
  ]
}
```

### Cancel Order
```http
POST /orders/:id/cancel
Authorization: Bearer <token>
```

### Download Digital File
```http
GET /orders/:orderId/download/:fileId
Authorization: Bearer <token>
```

Returns the file as a download.

---

## Shopping Cart

### Get Cart
```http
GET /cart
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "total_amount": 150000,
  "items": [
    {
      "id": "uuid",
      "quantity": 2,
      "unit_price": 50000,
      "total_price": 100000,
      "product": {
        "id": "uuid",
        "title": "Product Name",
        "price": 50000
      }
    }
  ]
}
```

### Add to Cart
```http
POST /cart/items
Authorization: Bearer <token>
```

**Body:**
```json
{
  "productId": "uuid",
  "quantity": 1
}
```

### Update Cart Item
```http
PUT /cart/items/:itemId
Authorization: Bearer <token>
```

**Body:**
```json
{
  "quantity": 3
}
```

### Remove from Cart
```http
DELETE /cart/items/:itemId
Authorization: Bearer <token>
```

### Clear Cart
```http
DELETE /cart
Authorization: Bearer <token>
```

---

## Notifications

### Get Notifications
```http
GET /notifications?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "order_created",
      "title": "Order Created",
      "message": "Your order #12345678 has been created successfully.",
      "data": {
        "orderId": "uuid",
        "amount": 100000
      },
      "is_read": false,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

### Get Unread Notifications
```http
GET /notifications/unread
Authorization: Bearer <token>
```

### Get Unread Count
```http
GET /notifications/unread/count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "count": 3
}
```

### Mark as Read
```http
POST /notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```http
POST /notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer <token>
```

---

## Media Upload

### Upload Product Image
```http
POST /media/upload/product-image
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Image file (JPEG, PNG, GIF, WebP, max 5MB)

**Response:**
```json
{
  "filename": "abc123.jpg",
  "original_name": "product.jpg",
  "file_path": "uploads/products/abc123.jpg",
  "file_size": 1024000,
  "mime_type": "image/jpeg",
  "url": "http://localhost:3000/api/v1/media/files/uploads%2Fproducts%2Fabc123.jpg"
}
```

### Upload Multiple Product Images
```http
POST /media/upload/product-images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `files`: Multiple image files (max 10 files)

### Upload Digital File
```http
POST /media/upload/digital-file
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Any file type (max 100MB)

### Upload Avatar
```http
POST /media/upload/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Image file (max 5MB)

### Get File
```http
GET /media/files/:path
```

Returns the file content with appropriate headers.

---

## Health Check

### Health Status
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "KUDZNED Backend",
  "version": "1.0.0"
}
```

### Readiness Check
```http
GET /health/ready
```

---

## WebSocket Events

Connect to WebSocket at: `ws://localhost:3000`

### Authentication
Send token in connection auth:
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events

**Incoming Events:**
- `notification` - New notification received
- `pending_notifications` - Unread notifications on connect
- `unread_count` - Updated unread count

**Outgoing Events:**
- `mark_read` - Mark notification as read
- `get_unread_count` - Request unread count

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Rate Limiting

- Default: 100 requests per minute per IP
- Authentication endpoints may have stricter limits
- Exceeded limits return 429 status code

---

## Data Types

### Amounts
All monetary amounts are in **satoshis** (1 BTC = 100,000,000 satoshis)

### Dates
All dates are in ISO 8601 format: `2024-01-01T00:00:00.000Z`

### UUIDs
All entity IDs are UUIDs: `550e8400-e29b-41d4-a716-446655440000`