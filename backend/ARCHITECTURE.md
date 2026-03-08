# Architecture Documentation

## MVC Architecture Overview

This project follows the **Model-View-Controller (MVC)** architectural pattern with additional service layer for business logic separation.

```
Request → Route → Controller → Service → Model → Database
```

## Directory Structure

```
backend/
├── src/
│   ├── config/              # Configuration & database connection
│   │   ├── database.js      # MySQL pool configuration
│   │   └── utils.js         # Utility functions
│   │
│   ├── models/              # Database models (M)
│   │   ├── User.js
│   │   ├── Barbershop.js
│   │   ├── Barber.js
│   │   ├── Queue.js
│   │   ├── Service.js
│   │   └── Appointment.js
│   │
│   ├── services/            # Business logic layer
│   │   ├── AuthService.js
│   │   ├── QueueService.js
│   │   ├── BarberService.js
│   │   └── BarbershopService.js
│   │
│   ├── controllers/         # HTTP handlers (C)
│   │   ├── AuthController.js
│   │   ├── QueueController.js
│   │   ├── BarberController.js
│   │   └── BarbershopController.js
│   │
│   ├── routes/              # API endpoint definitions (V)
│   │   ├── auth.js
│   │   ├── queue.js
│   │   ├── barbers.js
│   │   └── barbershops.js
│   │
│   └── middlewares/         # Express middlewares
│       ├── auth.js          # JWT & Role authentication
│       └── validators.js    # Validation & encryption utilities
│
├── database/
│   └── schema.sql           # MySQL schema & indexes
│
├── scripts/
│   └── seed.js              # Database seeding script
│
├── server.js                # Express app initialization
├── package.json             # Dependencies & scripts
├── .env.example             # Environment variables template
├── docker-compose.yml       # Docker configuration
└── README.md                # Project documentation
```

## Layer Responsibilities

### 1. Controllers (Request Handlers)
**File:** `src/controllers/*.js`

Responsibilities:
- Receive HTTP requests
- Validate request format/headers
- Call appropriate service methods
- Return HTTP responses
- Handle error responses

Example:
```js
static async join(req, res, next) {
  try {
    const { barbershopId, clientName, phone } = req.body;
    const client = await QueueService.joinQueue(
      barbershopId, clientName, phone
    );
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
}
```

### 2. Services (Business Logic)
**File:** `src/services/*.js`

Responsibilities:
- Implement business rules
- Validate data at business level
- Orchestrate multiple models
- Handle transactions
- Return domain objects

Example:
```js
static async joinQueue(barbershopId, clientName, phone) {
  if (!clientName) {
    throw createValidationError('Client name required');
  }
  const queueId = await Queue.create({
    barbershop_id: barbershopId,
    name: clientName,
    phone
  });
  return await Queue.findById(queueId);
}
```

### 3. Models (Data Access)
**File:** `src/models/*.js`

Responsibilities:
- Database query execution
- Row-level CRUD operations
- Data mapping to objects
- Query optimization

Example:
```js
static async create(data) {
  const { barbershop_id, name, phone } = data;
  const [result] = await pool.query(
    'INSERT INTO queue (...) VALUES (...)',
    [barbershop_id, name, phone]
  );
  return result.insertId;
}
```

### 4. Routes (URL Mapping)
**File:** `src/routes/*.js`

Responsibilities:
- Map HTTP routes to controllers
- Attach middleware (auth, validation)
- Define method (GET, POST, etc.)
- Export Express router

Example:
```js
router.post('/join', QueueController.join);
router.post(
  '/call-next',
  authMiddleware,
  QueueController.callNext
);
```

## Data Flow Example: Join Queue

```
Frontend HTTP Request
    ↓
POST /api/queue/join
    ↓
Route Handler (queue.js)
    ↓
QueueController.join()
    ├─ Validate input
    └─ Call QueueService.joinQueue()
        ↓
        QueueService.joinQueue()
        ├─ Business logic validation
        └─ Call Queue.create()
            ↓
            Queue.create() (Model)
            ├─ Calculate next position
            ├─ Execute SQL INSERT
            └─ Return queue ID
        ↓
        Queue.findById() (Model)
        ├─ Execute SQL SELECT
        └─ Return queue object
        ↓
        Return to Service
    ↓
    Return to Controller
    ↓
Response JSON with 201 status
    ↓
Frontend receives queue entry
```

## Authentication Flow

```
Frontend Call
    ↓
POST /api/auth/login
    ↓
AuthController.login()
├─ Verify email/password
└─ Call AuthService.login()
    ├─ Find user by email
    ├─ Compare password hashes
    └─ Return JWT token
        ↓
        generateJWT(user)
        └─ Sign user data with JWT_SECRET
    ↓
Response with token
    ↓
Frontend stores in localStorage
    ↓
Subsequent requests include:
Authorization: Bearer {token}
    ↓
authMiddleware checks token
├─ Verify signature
├─ Extract user data
└─ Attach to req.user
```

## Queue Management Flow (Complex)

```
User joins queue:
POST /api/queue/join
    ↓
Queue.create()
├─ Find max position
├─ Increment position
└─ Insert with position

Barber calls next:
POST /api/queue/call-next
    ↓
QueueService.callNextClient()
├─ Get first waiting entry
├─ Update status to 'called'
├─ Assign barber_id
└─ Update barber status to 'serving'

Multiple concurrent calls:
├─ Barber 1 calls next → Client 1
├─ Barber 2 calls next → Client 2
└─ Barber 3 calls next → Client 3

Database ensures:
├─ Position integrity via UNIQUE constraint
├─ No race conditions with row-level locks
└─ Each client served by one barber
```

## Database Schema Relationships

```
barbershops (1)
    ├──→ (N) users
    ├──→ (N) barbers
    ├──→ (N) queue entries
    ├──→ (N) services
    └──→ (N) appointments

barbers (1)
    ├──→ (1) barbershop
    ├──→ (N) queue entries (when serving)
    └──→ (N) appointments

queue entries (1)
    ├──→ (1) barbershop
    ├──→ (1) barber (optional, when serving)
    └──→ (1) service (optional)

appointments (1)
    ├──→ (1) barbershop
    ├──→ (1) barber
    └──→ (1) service
```

## Security Architecture

### Authentication & Authorization

```
Request Lifecycle:
    ↓
Express middleware chain
    ├─ Parse body/headers
    ├─ authMiddleware (if needed)
    │   ├─ Extract JWT from headers
    │   ├─ Verify signature using JWT_SECRET
    │   ├─ Attach decoded user to req.user
    │   └─ Return 401 if invalid
    │
    ├─ roleMiddleware (if needed)
    │   ├─ Check req.user.role
    │   ├─ Compare against required roles
    │   └─ Return 403 if unauthorized
    │
    └─ Controller executes
        └─ Has authenticated user info in req.user
```

### Password Security

```
Registration:
├─ Client sends plaintext password
├─ Validate format
├─ Hash with bcryptjs (10 rounds)
└─ Store hash in database

Login:
├─ User sends plaintext password
├─ Retrieve hash from database
├─ Compare with bcryptjs
└─ Plaintext never stored
```

### Data Validation

```
Input → Controller → Service → Model
  ↓        ✓           ✓         ✓
  
Each layer validates:
- Controllers: HTTP format, headers
- Services: Business rules, data integrity
- Models: SQL constraints
- Database: UNIQUE, NOT NULL, FOREIGN KEY
```

## Error Handling

```
Try-Catch Flow:

Controller
    ↓
try {
  await Service.method()
} catch (error) {
  next(error)  // Pass to error handler
}
    ↓
errorHandler middleware
    ├─ Check error.isValidationError → 400
    ├─ Check error.isNotFoundError → 404
    └─ Default → 500
    ↓
Response with JSON
```

## Database Connection Pooling

```
Application Start
    ↓
Create MySQL Connection Pool
├─ Min connections: 2
├─ Max connections: 10
├─ Keep-alive enabled
└─ Reuse connections

Request
    ↓
Get connection from pool
    ├─ If available: reuse immediately
    └─ If unavailable: wait or create new
    ↓
Execute query
    ↓
Release connection back to pool
```

## Performance Considerations

### Database Indexes

```sql
-- Already optimized with:
CREATE INDEX idx_queue_barbershop_status 
  ON queue(barbershop_id, status);

CREATE INDEX idx_barbers_barbershop_status 
  ON barbers(barbershop_id, status);
```

Purpose:
- `barbershop_id` queries (filtering by shop)
- `status` queries (finding waiting/serving)
- Composite for combined queries

### Pagination (Future)

```js
// Optional implementation
GET /api/queue?page=1&limit=50

controller:
const { page = 1, limit = 50 } = req.query;
const offset = (page - 1) * limit;
Queue.findByBarbershop(id, limit, offset);
```

### Caching Strategies

```
Next Phase Recommendations:
1. Redis for session storage
2. Cache barber list (rarely changes)
3. Cache popular services
4. Cache statistics (10s TTL)
```

## Scaling Architecture

### Horizontal Scaling

```
Load Balancer (Nginx)
    ├─→ Node Instance 1 (port 3001)
    ├─→ Node Instance 2 (port 3002)
    └─→ Node Instance 3 (port 3003)
           ↓
        Shared MySQL Database
```

### Database Scaling

```
Production Setup:
├─ Primary (write): RDS MySQL
├─ Read Replicas: 2-3 instances
└─ Connection pooling on each instance
```

## Extension Points

### Add a new feature

1. **Create Model**: `src/models/Feature.js`
2. **Create Service**: `src/services/FeatureService.js`
3. **Create Controller**: `src/controllers/FeatureController.js`
4. **Create Routes**: `src/routes/features.js`
5. **Add to server.js**: `app.use('/api/features', featureRoutes)`

### Add authentication layer

```js
// Custom middleware example
export const premiumMiddleware = (req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Premium feature' });
  }
  next();
};

router.post('/premium', authMiddleware, premiumMiddleware, Controller.action);
```

## Technology Stack Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js | JavaScript throughout, fast, scalable |
| Framework | Express | Lightweight, flexible, popular |
| Database | MySQL | Relational, ACID, widely supported |
| Auth | JWT | Stateless, scalable, standard |
| Encryption | bcryptjs | Password security standard |
| Connection | mysql2 | Promises, pool management, fast |

## CI/CD Considerations

```yaml
# Suggested pipeline
1. Lint: npm run lint
2. Test: npm run test
3. Build: npm run build
4. Deploy: docker push && deploy
5. Smoke tests: /health endpoint
```

## Monitoring & Observability

```
Application Metrics:
├─ Request count
├─ Response times
├─ Error rates
├─ Database query time
└─ Connection pool usage

Log Aggregation:
├─ All API requests logged
├─ Error stack traces
├─ Warning indicators
└─ Database slow queries
```

This architecture provides a clean separation of concerns, making the codebase maintainable, testable, and scalable.
