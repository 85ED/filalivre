# Fila Backend - Queue Management System

Complete backend for a barbershop queue management system built with Node.js, Express, and MySQL.

## Project Structure

```
backend/
├── src/
│   ├── controllers/      # Route handlers
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middlewares/     # Express middlewares
│   └── config/          # Configuration files
├── database/
│   └── schema.sql       # MySQL schema
├── server.js            # Entry point
├── package.json         # Dependencies
└── .env.example         # Environment variables template
```

## Features

- ✅ User authentication (JWT)
- ✅ Queue management with real-time updates
- ✅ Concurrent barbers support
- ✅ Multiple barbershops support
- ✅ Role-based access control (owner, admin, barber, client)
- ✅ Barber status management
- ✅ Queue history tracking
- ✅ RESTful API with polling support

## Prerequisites

- Node.js >= 16
- MySQL >= 5.7
- npm or yarn

## Installation

1. **Clone and enter directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Create database**
   - Option A: Run SQL directly
     ```bash
     mysql -u root -p < database/schema.sql
     ```
   
   - Option B: Use Docker (if MySQL is not installed)
     ```bash
     docker-compose up -d
     # Wait for MySQL to start
     mysql -h 127.0.0.1 -u root -ppassword < database/schema.sql
     ```

5. **Start server**
   ```bash
   npm run dev
   ```

   Server will be available at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user (requires auth)

### Queue Management
- `POST /api/queue/join` - Join queue
- `GET /api/queue/:barbershopId` - Get queue status (polling endpoint)
- `POST /api/queue/call-next` - Call next client
- `POST /api/queue/finish` - Mark client finished
- `POST /api/queue/remove` - Remove from queue
- `POST /api/queue/skip` - Skip client (no-show)
- `GET /api/queue/monitor/:barbershopId` - Monitor dashboard
- `GET /api/queue/history/:barbershopId` - Queue history

### Barbers Management
- `POST /api/barbers` - Create barber
- `GET /api/barbers/barbershop/:barbershopId` - List barbers
- `GET /api/barbers/available/:barbershopId` - Get available barbers
- `PATCH /api/barbers/status` - Update barber status
- `GET /api/barbers/:barberId` - Get barber details
- `PATCH /api/barbers/:barberId` - Update barber
- `DELETE /api/barbers/:barberId` - Delete barber

### Barbershops Management
- `GET /api/barbershops` - List all barbershops
- `POST /api/barbershops` - Create barbershop (owner only)
- `GET /api/barbershops/id/:id` - Get barbershop by ID
- `GET /api/barbershops/slug/:slug` - Get barbershop by slug
- `PATCH /api/barbershops/:id` - Update barbershop
- `DELETE /api/barbershops/:id` - Delete barbershop

## Database Schema

### Tables
- **barbershops** - Barbershop information
- **users** - Users and staff
- **barbers** - Barber profiles and status
- **queue** - Queue entries
- **services** - Services offered
- **appointments** - Scheduled appointments

## Authentication

API uses JWT (JSON Web Tokens) for authentication:

1. **Register/Login** to get a token
2. **Include token** in headers: `Authorization: Bearer {token}`
3. **Token expires** in 7 days (configurable)

Roles available:
- `owner` - Barbershop owner
- `admin` - Barbershop administrator
- `barber` - Barber staff member
- `client` - Regular client (default)

## Queue Logic

### Joining Queue
1. Client posts name and phone
2. System assigns next position
3. Client receives queue ID and position

### Calling Next Client
1. Barber requests next client via `POST /api/queue/call-next`
2. System marks first waiting client as "called"
3. Assigns barber ID to client
4. Barber status changes to "serving"

### Concurrent Barbers
- Each barber can independently call clients
- Queue skips already-serving clients
- Multiple barbers can serve simultaneously

### Finishing Service
1. Barber marks client as finished via `POST /api/queue/finish`
2. Client record updated with end time
3. Barber automatically gets next client (if available)
4. Or barber returns to "available" status

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=filadb

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Development Commands

```bash
# Start dev server with auto-reload
npm run dev

# Start production server
npm start

# Run database seed (if seed.js created)
npm run seed
```

## Deployment

### Environment Setup
1. Set production environment variables
2. Use strong JWT_SECRET
3. Configure CORS_ORIGIN for frontend domain
4. Set NODE_ENV=production

### Database
- Use managed MySQL service (AWS RDS, Azure Database, etc.)
- Configure proper backups
- Set up read replicas for high-scale

### Server
- Deploy on Node.js hosting (Heroku, Digital Ocean, AWS, etc.)
- Use process manager (PM2)
- Set up reverse proxy (Nginx)
- Enable HTTPS/SSL

### Performance
- Enable connection pooling (already configured)
- Add Redis for caching (optional)
- Implement request rate limiting (optional)
- Set up database indexes (schema already optimized)

## Monitoring

- Check logs: Application logs show all requests
- Monitor database: Check MySQLprocesslist
- Health check: `GET /health` returns `{status: 'ok'}`

## Error Handling

All errors follow this format:
```json
{
  "error": "Error message",
  "details": "Additional info (dev mode only)"
}
```

Status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request / Validation error
- `401` - Unauthorized
- `403` - Access denied
- `404` - Not found
- `500` - Server error

## Support for Frontend

The frontend (React/Vite) polls the `/api/queue/:barbershopId` endpoint every 5 seconds to get:
- Current queue status
- Barber positions
- Client information

This allows real-time updates without WebSockets.

## License

MIT

##Contact

For support or questions, contact the development team.
