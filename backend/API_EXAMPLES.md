# API Examples - Fila Backend

## Authentication

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "senha123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "senha123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Barbershops

### Create Barbershop (owner only)
```bash
curl -X POST http://localhost:3001/api/barbershops \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Barbershop Premium",
    "slug": "barbershop-premium"
  }'
```

### Get All Barbershops
```bash
curl -X GET http://localhost:3001/api/barbershops
```

### Get Barbershop by ID
```bash
curl -X GET http://localhost:3001/api/barbershops/id/1
```

### Get Barbershop by Slug
```bash
curl -X GET http://localhost:3001/api/barbershops/slug/barbershop-premium
```

## Barbers

### Create Barber
```bash
curl -X POST http://localhost:3001/api/barbers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "barbershopId": 1,
    "name": "Carlos"
  }'
```

### Get Barbers by Barbershop
```bash
curl -X GET http://localhost:3001/api/barbers/barbershop/1
```

### Get Available Barbers
```bash
curl -X GET http://localhost:3001/api/barbers/available/1
```

### Update Barber Status
```bash
curl -X PATCH http://localhost:3001/api/barbers/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "barberId": 1,
    "status": "serving"
  }'
```

Status options: available | serving | paused | offline

## Queue

### Join Queue
```bash
curl -X POST http://localhost:3001/api/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "barbershopId": 1,
    "clientName": "Maria Santos",
    "phone": "11987654321",
    "serviceId": null
  }'
```

### Get Queue (Polling)
```bash
curl -X GET http://localhost:3001/api/queue/1
```

### Call Next Client
```bash
curl -X POST http://localhost:3001/api/queue/call-next \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "barbershopId": 1,
    "barberId": 1
  }'
```

### Finish Current Client
```bash
curl -X POST http://localhost:3001/api/queue/finish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "barbershopId": 1,
    "barberId": 1
  }'
```

### Remove Client from Queue
```bash
curl -X POST http://localhost:3001/api/queue/remove \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "queueId": 5,
    "barbershopId": 1
  }'
```

### Skip Client (No-show)
```bash
curl -X POST http://localhost:3001/api/queue/skip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "queueId": 5,
    "barbershopId": 1
  }'
```

### Queue Monitor Dashboard
```bash
curl -X GET http://localhost:3001/api/queue/monitor/1
```

### Queue History
```bash
curl -X GET "http://localhost:3001/api/queue/history/1?limit=50"
```

## Health Check

```bash
curl -X GET http://localhost:3001/health
```

## Example JWT Token Response

```json
{
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "client"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Examples

### Missing Required Fields
```json
{
  "error": "Email and password are required"
}
```

### Invalid Credentials
```json
{
  "error": "Invalid email or password"
}
```

### Unauthorized
```json
{
  "error": "No token provided"
}
```

### Access Denied
```json
{
  "error": "Access denied. Required roles: owner"
}
```

## Frontend Integration Example (React/TypeScript)

```typescript
// Call next client endpoint polling (every 5 seconds)
setInterval(async () => {
  const response = await fetch(`/api/queue/${barbershopId}`);
  const data = await response.json();
  // Update UI with queue status
  setQueueStatus(data);
}, 5000);
```
