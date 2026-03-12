# FASE 2 - Endpoints Documentation

## Overview

FASE 2 implementação completa com 2 novos endpoints para gerenciar créditos WhatsApp.

---

## Endpoints Implementados

### 1. GET /api/whatsapp/usage

Retorna estatísticas de uso de WhatsApp para a barbearia autenticada.

**Autenticação**: Obrigatória (JWT token)

**Request:**
```http
GET /api/whatsapp/usage
Authorization: Bearer <jwt_token>
```

**Query Parameters**: Nenhum (usa barbershopId do JWT autenticado)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "used": 150,
    "limit": 500,
    "extra_credits": 100,
    "total_available": 600,
    "percentage": 30,
    "can_send": true,
    "alert": {
      "active": false,
      "threshold": 80,
      "message": null
    }
  }
}
```

**Response Fields:**
- `used`: Notificações enviadas este mês
- `limit`: Limite mensal (default 500)
- `extra_credits`: Créditos adicionais comprados
- `total_available`: Total = limit + extra_credits
- `percentage`: Percentual de uso = (used / total_available) * 100
- `can_send`: Boolean, true se used < total_available
- `alert.active`: Boolean, true quando percentage >= 80% AND percentage < 100%
- `alert.threshold`: Threshold para alerta (80%)
- `alert.message`: Mensagem de alerta quando ativo

**Error Response (401 - Não autenticado):**
```json
{
  "error": "Authorization header missing"
}
```

**Error Response (403 - Tentando acessar outra barbearia):**
```json
{
  "error": "Forbidden - you can only view your own barbershop usage"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to fetch WhatsApp usage statistics",
  "details": "Error message from database"
}
```

**cURL Example:**
```bash
curl -X GET 'http://localhost:8080/api/whatsapp/usage' \
  -H 'Authorization: Bearer <jwt_token>' \
  -H 'Accept: application/json'
```

---

### 2. POST /api/whatsapp/buy-credits

Inicia processo de compra de créditos WhatsApp. Em FASE 4, irá redirecionar para Stripe.

**Autenticação**: Obrigatória (JWT token)

**Request:**
```http
POST /api/whatsapp/buy-credits
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "package": "100"
}
```

**Request Body:**
- `package` (required): Opção de pacote: "100", "300", ou "1000"
- `barbershopId` (optional): Se fornecido, deve ser igual ao barbershopId autenticado (validação de propriedade)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "barbershopId": 1,
    "package": {
      "quantity": 100,
      "price": 10.00,
      "priceFormatted": "R$ 10,00",
      "description": "100 notificações WhatsApp"
    },
    "message": "Stripe integration pending (FASE 4)"
  }
}
```

**Available Packages:**
- `100`: R$ 10,00
- `300`: R$ 20,00
- `1000`: R$ 50,00

**Response (FASE 4 - With Stripe):**
```json
{
  "success": true,
  "data": {
    "barbershopId": 1,
    "package": {
      "quantity": 100,
      "price": 99.90,
      "priceFormatted": "R$ 99,90"
    },
    "sessionId": "cs_test_a1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U",
    "url": "https://checkout.stripe.com/pay/cs_test_a1B2C3D4E5F6..."
  }
}
```

**Error Response (401 - Não autenticado):**
```json
{
  "error": "Authorization header missing"
}
```

**Error Response (400 - Package inválido):**
```json
{
  "error": "package is required (100, 300, or 1000)"
}
```

```json
{
  "error": "Invalid package. Available options: 100, 300, 1000"
}
```

**Error Response (403 - Tentando comprar para outra barbearia):**
```json
{
  "error": "Forbidden - you can only purchase credits for your own barbershop"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to initiate credit purchase",
  "details": "Error message from database"
}
```

**cURL Example:**
```bash
curl -X POST 'http://localhost:8080/api/whatsapp/buy-credits' \
  -H 'Authorization: Bearer <jwt_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "package": "100"
  }'
```

---

## Integration with Queue Flow

### Automatic Notification on Queue Call

Quando um barbeiro chama o próximo cliente:

```
POST /api/queue/call-next
├─ QueueService.callNextClient(barbershopId, barberId)
│  ├─ Get next client
│  ├─ Update barber status to "serving"
│  └─ [NEW] WhatsAppNotificationService.notifyIfEligible()
│     ├─ Check usage limit: WhatsAppUsageService.canSendMessage() ✅
│     ├─ Validate notification criteria
│     ├─ Rate limit: 300ms between notifications
│     ├─ Send message to WhatsApp microservice
│     └─ Mark queue.notificado_whatsapp = 1
│        └─ WhatsAppUsageService.incrementUsage() (audit trail)
└─ Return client
```

**Service Layer (sem HTTP interno)**:
```javascript
// NotificationService chama direto a UsageService (não faz HTTP)
const canSend = await WhatsAppUsageService.canSendMessage(barbershopId);
if (!canSend) {
  return { sent: false, reason: 'Limit reached' };
}
```

**Non-Blocking Pattern:**
```javascript
// Notification runs asynchronously
WhatsAppNotificationService.notifyIfEligible(barbershopId, clientQueueId)
  .catch((err) => {
    console.error('[Queue] WhatsApp notification error:', err.message);
  });

// Queue operation returns immediately
return client;
```

---

## Database Tables Used

### whatsapp_usage (Current Month)
```sql
SELECT * FROM whatsapp_usage 
WHERE barbershop_id = 1 
  AND mes_referencia = DATE_FORMAT(CURDATE(), '%Y-%m-01');
```

**Data Flow:**
1. GET /api/whatsapp/usage → WhatsAppUsageService.getStats()
2. POST /api/whatsapp/buy-credits → Checks existing record or creates new
3. Queue notification → WhatsAppUsageService.incrementUsage()

### whatsapp_credits_log (Audit Trail)
```sql
SELECT * FROM whatsapp_credits_log 
WHERE barbershop_id = 1 
ORDER BY created_at DESC;
```

**Logged Events:**
- `tipo_movimento = 'compra'`: Credit purchase (completed in FASE 4)
- `tipo_movimento = 'uso'`: Message sent (automatic from queue)
- `tipo_movimento = 'ajuste'`: Manual credit adjustment (admin only)

---

## Rate Limiting

**Implementation:** Service-level, static Map tracking per barbershop

```javascript
// WhatsAppNotificationService.js
static lastNotificationTime = new Map(); // { barbershopId → timestamp }
static NOTIFICATION_DELAY_MS = 300;      // minimum 300ms between notifications

// When notifying:
const timeSince = Date.now() - (this.lastNotificationTime.get(barbershopId) || 0);
if (timeSince < NOTIFICATION_DELAY_MS) {
  await new Promise(resolve => 
    setTimeout(resolve, NOTIFICATION_DELAY_MS - timeSince)
  );
}
this.lastNotificationTime.set(barbershopId, Date.now());
```

**Why 300ms?**
- Prevents Chromium process crash from rapid notifications
- Microservice can handle ~3 messages per second safely
- User experience: notifications space out naturally

---

## Testing Checklist

### Unit Tests
- [ ] WhatsAppController.getUsage() with valid barbershopId
- [ ] WhatsAppController.getUsage() without barbershopId
- [ ] WhatsAppController.buyCredits() with valid package
- [ ] WhatsAppController.buyCredits() with invalid package
- [ ] WhatsAppController.buyCredits() without barbershopId

### Integration Tests
- [ ] Rate limit enforcement (300ms spacing)
- [ ] notificado_whatsapp flag updates correctly
- [ ] usage counter increments on send
- [ ] Monthly reset triggers on new month (mes_referencia)
- [ ] Extra credits apply correctly to total_available
- [ ] Queue notifications don't block queue operations

### Manual Testing Scenarios

**Scenario 1: Check Usage**
```bash
# Should show 0 used, can_send = true, alert.active = false
curl 'http://localhost:8080/api/whatsapp/usage' \
  -H 'Authorization: Bearer <jwt_token>'
```

**Scenario 2: Simulate Notifications**
```bash
# Manually call next client 10 times rapidly
# Should see 300ms delays between actual sends
# Check notificado_whatsapp = 1 on clients
```

**Scenario 3: Hit Usage Limit**
```bash
# Create 500+ queue entries and call them
# At entry 501, should return can_send = false
# GET /usage should show percentage > 100
```

**Scenario 4: Buy Credits**
```bash
# Call POST /buy-credits (will complete in FASE 4)
# Check whatsapp_credits_log for 'compra' entry
# Verify total_available = 500 + extra_credits
```

---

## Files Modified Summary

| File | Changes | Lines |
|------|---------|-------|
| [backend/src/services/QueueService.js](backend/src/services/QueueService.js) | Import WhatsAppNotificationService, call in callNextClient() | +5 |
| [backend/src/controllers/WhatsAppController.js](backend/src/controllers/WhatsAppController.js) | Add getUsage() and buyCredits() methods | +100 |
| [backend/src/routes/whatsapp.js](backend/src/routes/whatsapp.js) | Register GET /usage and POST /buy-credits routes | +3 |
| [backend/server.js](backend/server.js) | Import routes, register before proxy, add skip logic | +15 |

---

## What's in FASE 3

Frontend implementation to display usage and purchasing UI:

1. **useWhatsAppUsage Hook** - Fetch usage stats
2. **WhatsAppUsageCard Component** - Display KPI on dashboard
3. **BuyCreditsModal Component** - Purchase interface
4. **Dashboard Integration** - Add card to admin/owner page

---

## What's in FASE 4

Stripe payment integration:

1. **Stripe Session Creation** - In buyCredits endpoint
2. **Payment Webhook Handler** - Process payment_intent.succeeded
3. **Credit Crediting** - Add purchased credits to account
4. **Receipt/History** - Show in dashboard

---

## Configuration

All settings hardcoded appropriately for now:

- Monthly limit: 500 notifications
- Rate limit: 300ms minimum between sends
- Packages: 100/300/1000 notifications
- Notification criteria: position ≤ 3 AND position > num_barbers

To modify: Edit WhatsAppUsageService.createCheckout() or service constants.

