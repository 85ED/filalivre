# Frontend Integration Guide

This backend is designed to work seamlessly with the React/Vite frontend included in this project.

## CORS Configuration

The backend is pre-configured to accept requests from `http://localhost:5173` (the default Vite dev server).

### For Production

Update the `CORS_ORIGIN` environment variable:
```env
# Development
CORS_ORIGIN=http://localhost:5173

# Production
CORS_ORIGIN=https://yourdomain.com
```

## API Integration Points

### 1. Authentication Flow

```typescript
// Frontend: Login hook
const { data } = await api.post('/auth/login', { email, password });
localStorage.setItem('token', data.token);
```

```typescript
// Add token to all subsequent requests
const config = {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
};
```

### 2. Queue Management

Frontend polls every 5 seconds:
```typescript
setInterval(async () => {
  const response = await fetch(`/api/queue/${barbershopId}`);
  const { queue, stats } = await response.json();
  // Update UI with queue status
}, 5000);
```

Response structure:
```json
{
  "queue": [
    {
      "id": 1,
      "barbershop_id": 1,
      "name": "João Silva",
      "phone": "11987654321",
      "status": "waiting",
      "position": 1,
      "barber_id": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "stats": {
    "total": 4,
    "waiting": 3,
    "serving": 1,
    "called": 0
  }
}
```

### 3. Barber Operations

Join queue as client:
```typescript
await api.post('/api/queue/join', {
  barbershopId: 1,
  clientName: 'Maria Santos',
  phone: '11987654321',
  serviceId: 1
});
```

Barber calls next client:
```typescript
await api.post('/api/queue/call-next', {
  barbershopId: 1,
  barberId: 1
}, { headers: { 'Authorization': `Bearer ${token}` } });
```

## State Management Example

```typescript
// Using React Hooks
const [queue, setQueue] = useState([]);
const [barbers, setBarbers] = useState([]);

// Fetch data
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/queue/${barbershopId}`);
    const data = await response.json();
    setQueue(data.queue);
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
}, [barbershopId]);
```

## Error Handling

All API errors follow this format:

```typescript
try {
  await api.post('/api/queue/join', data);
} catch (error) {
  if (error.response?.status === 400) {
    // Validation error
    console.error(error.response.data.error);
  } else if (error.response?.status === 401) {
    // Unauthorized - refresh token
    localStorage.removeItem('token');
    window.location.href = '/login';
  } else if (error.response?.status === 403) {
    // Access denied - insufficient permissions
    console.error('Access denied');
  }
}
```

## Component Integration Examples

### Queue Display Component
```typescript
export function QueueDisplay({ barbershopId }) {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchQueue = async () => {
      const response = await fetch(`/api/queue/${barbershopId}`);
      const data = await response.json();
      setQueue(data.queue);
      setStats(data.stats);
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [barbershopId]);

  return (
    <div>
      <h2>Fila ({stats?.total || 0})</h2>
      <ul>
        {queue.map((client, index) => (
          <li key={client.id}>
            {index + 1}. {client.name} - {client.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Barber Dashboard Component
```typescript
export function BarberDashboard({ barbershopId, barberId, token }) {
  const [currentClient, setCurrentClient] = useState(null);
  const [barberStatus, setBarberStatus] = useState('available');

  const callNext = async () => {
    const response = await fetch('/api/queue/call-next', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        barbershopId,
        barberId
      })
    });
    const data = await response.json();
    setCurrentClient(data.client);
  };

  const finishClient = async () => {
    const response = await fetch('/api/queue/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        barbershopId,
        barberId
      })
    });
    const data = await response.json();
    if (data.nextClient) {
      setCurrentClient(data.nextClient);
    } else {
      setCurrentClient(null);
    }
  };

  return (
    <div>
      {currentClient ? (
        <div>
          <h3>Atendendo: {currentClient.name}</h3>
          <button onClick={finishClient}>Finalizar</button>
        </div>
      ) : (
        <button onClick={callNext}>Chamar Próximo</button>
      )}
    </div>
  );
}
```

## Real-time Updates Strategy

### Option 1: Polling (Current Implementation)
- Frontend polls every 5 seconds
- Simple to implement
- Works without additional dependencies
- Slightly higher latency
- **Used by default**

### Option 2: WebSockets (Future)
Consider adding Socket.IO for real-time updates:

```typescript
// Backend
import { Server } from 'socket.io';
const io = new Server(server, { cors: { origin: '*' } });

app.post('/api/queue/call-next', (req, res) => {
  // ... logic
  io.emit('queue:updated', newQueue);
});

// Frontend
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
socket.on('queue:updated', (data) => {
  setQueue(data);
});
```

## Environment Setup for Frontend

Frontend .env should match backend:
```env
VITE_API_URL=http://localhost:3001
VITE_API_TIMEOUT=30000
```

Update axios/fetch instance:
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: import.meta.env.VITE_API_TIMEOUT
});
```

## TypeScript Types

For better type safety in the frontend:

```typescript
// types/api.ts
export interface QueueEntry {
  id: number;
  barbershop_id: number;
  name: string;
  phone?: string;
  status: 'waiting' | 'called' | 'serving' | 'finished' | 'removed' | 'no_show';
  position: number;
  barber_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Barber {
  id: number;
  barbershop_id: number;
  name: string;
  status: 'available' | 'serving' | 'paused' | 'offline';
  current_client_id?: number;
}

export interface AuthResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'barber' | 'client';
  };
  token: string;
}

export interface QueueResponse {
  queue: QueueEntry[];
  stats: {
    total: number;
    waiting: number;
    serving: number;
    called: number;
  };
}
```

## Testing Integration

### Local Testing
1. Start backend: `npm run dev` (port 3001)
2. Start frontend: `npm run dev` (port 5173 default)
3. Test endpoints using provided examples
4. Monitor frontend for real-time updates

### Using Mock Data (Optional)
```typescript
// For frontend development without backend
const mockQueue = [
  { id: 1, name: 'João', status: 'waiting', position: 1 },
  { id: 2, name: 'Maria', status: 'waiting', position: 2 },
];

// Use with a custom hook to toggle between mock and real
const useQueue = (useMock = false) => {
  if (useMock) return mockQueue;
  // Fetch from API
};
```

## Performance Optimization

### API Response Caching
```typescript
const queryClient = new QueryClient();

export function QueueDisplay() {
  const { data } = useQuery(
    ['queue', barbershopId],
    () => fetchQueue(barbershopId),
    {
      staleTime: 4000, // Reuse data for 4 seconds
      refetchInterval: 5000 // Refetch every 5 seconds
    }
  );
}
```

### Minimize Payload
- Frontend requests only needed fields
- Backend returns optimized responses
- Consider pagination for large queues

## Debugging

### Enable Request Logging
```typescript
// Frontend
window.addEventListener('beforeunload', () => {
  console.log('API Requests:', api.defaults);
});
```

### Backend Logging
```typescript
// Already configured - check console output
```

## Support

For issues or questions about backend integration, refer to:
- API_EXAMPLES.md - Full API examples
- README.md - Backend setup
- Controller files - Implementation details
