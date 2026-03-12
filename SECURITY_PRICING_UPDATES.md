# FASE 2 - Security & Pricing Updates ✅

Data: 12 de março de 2026

## Resumo dos 4 Ajustes Implementados

### 1️⃣ Segurança no Endpoint GET /api/whatsapp/usage

**Problema**: Endpoint aceitava `barbershopId` como query param, permitindo que usuários vissem dados de outras barbearias.

**Solução**: Adicionado `authMiddleware` e validação de propriedade.

**Implementação**:
- [backend/src/routes/whatsapp.js](backend/src/routes/whatsapp.js): Adicionado `authMiddleware` na rota GET /usage
- [backend/src/controllers/WhatsAppController.js](backend/src/controllers/WhatsAppController.js): Método `getUsage()` agora:
  - Obtém `barbershopId` do JWT autenticado (`req.user.barbershopId`)
  - Valida ownership se query param fornecido
  - Retorna 401 se não autenticado
  - Retorna 403 se tentar acessar outra barbearia

**Antes**:
```javascript
const { barbershopId } = req.query; // ❌ Inseguro
if (!barbershopId) {
  return res.status(400).json({ error: 'barbershopId query parameter is required' });
}
```

**Depois**:
```javascript
const userBarbershopId = req.user?.barbershopId; // ✅ Do JWT
if (!userBarbershopId) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// Validar se tentando acessar outra barbearia
const queryBarbershopId = parseInt(req.query.barbershopId);
if (queryBarbershopId && queryBarbershopId !== userBarbershopId) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**POST /api/whatsapp/buy-credits**: Também recebeu o mesmo tratamento.

---

### 2️⃣ Preços dos Pacotes Corrigidos

**Problema**: Preços hardcoded não batiam com o plano original.

| Preço Antigo | Preço Novo (Correto) |
|---|---|
| 100 → R$ 99,90 | 100 → R$ 10,00 |
| 300 → R$ 249,90 | 300 → R$ 20,00 |
| 1000 → R$ 699,90 | 1000 → R$ 50,00 |

**Implementação**: [backend/src/services/WhatsAppUsageService.js](backend/src/services/WhatsAppUsageService.js)

```javascript
static async createCheckout() {
  const packages = [
    {
      quantity: 100,
      price: 10.00,
      priceFormatted: 'R$ 10,00',
      description: '100 notificações WhatsApp',
    },
    {
      quantity: 300,
      price: 20.00,
      priceFormatted: 'R$ 20,00',
      description: '300 notificações WhatsApp',
    },
    {
      quantity: 1000,
      price: 50.00,
      priceFormatted: 'R$ 50,00',
      description: '1000 notificações WhatsApp',
    },
  ];

  return packages;
}
```

**Response Atualizado**:
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
    }
  }
}
```

---

### 3️⃣ Verificação de Limite Antes de Enviar

**Verificação**: Já estava implementada! ✅

[backend/src/services/WhatsAppNotificationService.js](backend/src/services/WhatsAppNotificationService.js):

```javascript
static async notifyIfEligible(barbershopId, queueId) {
  try {
    // 1. Verificar se pode enviar (limite)
    const canSend = await WhatsAppUsageService.canSendMessage(barbershopId);
    if (!canSend) {
      const stats = await WhatsAppUsageService.getStats(barbershopId);
      console.warn(
        `[WhatsAppNotificationService] Limit reached for barbershop ${barbershopId}. ` +
        `Used: ${stats.used}/${stats.total_available}`
      );
      return { sent: false, reason: 'Limit reached', stats };
    }
    // ... resto do código
  }
}
```

**Melhoria Feita**: Adicionado log mais informativo mostrando quantas notificações foram usadas vs. total.

---

### 4️⃣ Alert Threshold em 80%

**Implementação**: [backend/src/services/WhatsAppUsageService.js](backend/src/services/WhatsAppUsageService.js)

Função `getStats()` agora retorna objeto `alert`:

```javascript
static async getStats(barbershopId) {
  // ... código anterior ...
  
  // Alert threshold: 80% usage
  const alertThreshold = 80;
  const alertActive = percentage >= alertThreshold && percentage < 100;

  return {
    used: usage.notificacoes_enviadas,
    limit: usage.limite_mensal,
    extra_credits: usage.creditos_extra,
    total_available: limitTotal,
    percentage,
    can_send: canSend,
    alert: {
      active: alertActive,
      threshold: alertThreshold,
      message: alertActive
        ? `Você está usando ${percentage}% das notificações disponíveis`
        : null,
    },
  };
}
```

**Response com Alert Ativo (85% de uso)**:
```json
{
  "success": true,
  "data": {
    "used": 425,
    "limit": 500,
    "extra_credits": 0,
    "total_available": 500,
    "percentage": 85,
    "can_send": true,
    "alert": {
      "active": true,
      "threshold": 80,
      "message": "Você está usando 85% das notificações disponíveis"
    }
  }
}
```

**Frontend pode usar**: Mostrar aviso amarelo quando `alert.active === true`

---

## Impacto nos Logs

### Antes (Nenhuma informação de limite):
```
[WhatsAppNotificationService] Limit reached for barbershop 1
```

### Depois (Com informações úteis):
```
[WhatsAppNotificationService] Limit reached for barbershop 1. Used: 500/500
[WhatsAppNotificationService] ✓ Notification sent to 5511999999999. Usage: 376/500 (75%)
```

---

## Resumo de Requisições

### GET /api/whatsapp/usage (Autenticado)

**Request**:
```bash
curl -X GET 'http://localhost:8080/api/whatsapp/usage' \
  -H 'Authorization: Bearer <jwt_token>'
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "used": 300,
    "limit": 500,
    "extra_credits": 100,
    "total_available": 600,
    "percentage": 50,
    "can_send": true,
    "alert": {
      "active": false,
      "threshold": 80,
      "message": null
    }
  }
}
```

**Response (401 - Não autenticado)**:
```json
{ "error": "Authorization header missing" }
```

**Response (403 - Tentando acessar outra barbearia)**:
```json
{ "error": "Forbidden - you can only view your own barbershop usage" }
```

---

### POST /api/whatsapp/buy-credits (Autenticado)

**Request**:
```bash
curl -X POST 'http://localhost:8080/api/whatsapp/buy-credits' \
  -H 'Authorization: Bearer <jwt_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "barbershopId": 1,
    "package": "100"
  }'
```

**Response (200)**:
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

**Response (403 - Tentando comprar para outra barbearia)**:
```json
{ "error": "Forbidden - you can only purchase credits for your own barbershop" }
```

---

## Validação

✅ Sem erros de sintaxe
✅ Autenticação integrada
✅ Preços alinhados com plano
✅ Limite validado antes de enviar
✅ Alert threshold em 80%

---

## Próximos Passos

**FASE 3 - Frontend**:
1. Usar `alert.active` e `alert.message` para mostrar aviso na dashboard
2. Exibir percentual visualmente (progress bar?)
3. CTA para comprar créditos quando `percentage >= 80`

**FASE 4 - Stripe**:
1. Implementar Stripe checkout no `buyCredits` endpoint
2. Adicionar webhook para `payment_intent.succeeded`
3. Creditar notificações após pagamento confirmado

---

## Files Modified

| File | Change | Impact |
|---|---|---|
| [backend/src/routes/whatsapp.js](backend/src/routes/whatsapp.js) | Adicionado authMiddleware | GET /usage protegido |
| [backend/src/controllers/WhatsAppController.js](backend/src/controllers/WhatsAppController.js) | Validação de propriedade em getUsage() e buyCredits() | Segurança implementada |
| [backend/src/services/WhatsAppUsageService.js](backend/src/services/WhatsAppUsageService.js) | Preços corrigidos + alert threshold | Preços certos + alertas |
| [backend/src/services/WhatsAppNotificationService.js](backend/src/services/WhatsAppNotificationService.js) | Logs melhorados com stats | Debugging facilitado |

