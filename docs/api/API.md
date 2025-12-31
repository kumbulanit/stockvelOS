# Stockvel OS API Documentation

## Base URL

```
Production: https://api.stockvelos.co.za/api/v1
Staging:    https://staging-api.stockvelos.co.za/api/v1
Local:      http://localhost:3000/api/v1
```

## Authentication

All authenticated endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh endpoint to get a new pair:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

---

## Endpoints

### Health

#### GET /health
Check if the API is running.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-12-31T12:00:00.000Z"
}
```

#### GET /health/ready
Check if all dependencies are healthy.

**Response:** `200 OK` or `503 Service Unavailable`

---

### Authentication

#### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "+27821234567",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "phone": "+27821234567",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2024-12-31T12:00:00.000Z"
}
```

#### POST /auth/login
Authenticate and receive tokens.

**Request:**
```json
{
  "phone": "+27821234567",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

### Stokvels

#### GET /stokvels
List user's stokvels.

**Query Parameters:**
- `type` (optional): Filter by type (SAVINGS, GROCERY, BURIAL, ROSCA)
- `status` (optional): Filter by status (ACTIVE, SUSPENDED, CLOSED)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Family Savings",
      "type": "SAVINGS",
      "memberCount": 12,
      "balance": "12500.0000",
      "currency": "ZAR",
      "myRole": "MEMBER",
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

#### POST /stokvels
Create a new stokvel.

**Request:**
```json
{
  "name": "Family Savings",
  "type": "SAVINGS",
  "description": "Monthly family savings club",
  "contributionAmount": "1000.00",
  "contributionFrequency": "MONTHLY",
  "rules": {
    "lateFee": "50.00",
    "gracePeriodDays": 5
  }
}
```

#### GET /stokvels/:id
Get stokvel details.

#### GET /stokvels/:id/members
List stokvel members.

#### GET /stokvels/:id/ledger
Get stokvel ledger entries.

**Query Parameters:**
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `type` (optional): Filter by entry type

---

### Contributions

#### POST /contributions
Submit a contribution.

**Request:**
```json
{
  "stokvelId": "uuid",
  "amount": "1000.00",
  "periodStart": "2024-12-01",
  "periodEnd": "2024-12-31",
  "popDocumentId": "uuid",
  "idempotencyKey": "uuid-v7"
}
```

**Response:** `201 Created` or `200 OK` (idempotent replay)
```json
{
  "id": "uuid",
  "stokvelId": "uuid",
  "amount": "1000.0000",
  "status": "PENDING",
  "createdAt": "2024-12-31T12:00:00.000Z"
}
```

#### POST /contributions/:id/approve
Approve a contribution (treasurer/chairman only).

#### POST /contributions/:id/reject
Reject a contribution with reason.

---

## Error Responses

All errors follow this format:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| AUTHENTICATION_ERROR | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate or conflicting data |
| BUSINESS_RULE_ERROR | 422 | Business logic violation |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user
- Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Idempotency

All POST/PUT requests should include an `idempotencyKey` (UUID v7) for safe retries.

```json
{
  "idempotencyKey": "01941234-5678-7abc-def0-123456789abc",
  ...
}
```

The server stores idempotency keys for 7 days. Duplicate requests return the original response.
