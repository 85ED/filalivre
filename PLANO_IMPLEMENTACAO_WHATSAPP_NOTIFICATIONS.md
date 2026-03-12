# Plano de Implementação: Sistema de Notificações WhatsApp

## 1. MUDANÇAS NO BANCO DE DADOS

### 1.1 Nova Tabela: `whatsapp_usage`

**Propósito:** Rastrear notificações enviadas por estabelecimento e mês

```sql
CREATE TABLE whatsapp_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  mes_referencia DATE NOT NULL,
  notificacoes_enviadas INT DEFAULT 0,
  limite_mensal INT DEFAULT 500,
  creditos_extra INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  UNIQUE KEY unique_barbershop_mes (barbershop_id, mes_referencia),
  INDEX idx_barbershop_mes (barbershop_id, mes_referencia)
);
```

**Campos:**
- `barbershop_id`: FK para identificar o estabelecimento
- `mes_referencia`: Primeiro dia do mês (2026-03-01, 2026-04-01, etc)
- `notificacoes_enviadas`: Contador de notificações enviadas neste mês
- `limite_mensal`: 500 por padrão (editável por admin)
- `creditos_extra`: Notificações compradas adicionalmente
- Índices para performa nas buscas frequentes

### 1.2 Alteração na Tabela: `queue`

**Adicionar campo:**

```sql
ALTER TABLE queue ADD COLUMN notificado_whatsapp BOOLEAN DEFAULT FALSE;
```

**Propósito:**
- Rastrear quais clientes já receberam notificação
- Prevents duplicate notifications
- Reseta automaticamente quando cliente é removido da fila

### 1.3 Alteração na Tabela: `barbershops`

**Adicionar campos para controle de WhatsApp:**

```sql
ALTER TABLE barbershops ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE barbershops ADD COLUMN whatsapp_phone VARCHAR(20) NULL;
```

**Propósito:**
- `whatsapp_enabled`: F/F para desabilitar notificações rapidamente
- `whatsapp_phone`: Guardar número conectado (para referência/logs)

### 1.4 Nova Tabela: `whatsapp_credits_log` (Auditoria)

**Propósito:** Log de todas as transações de créditos

```sql
CREATE TABLE whatsapp_credits_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  tipo_movimento ENUM('compra', 'uso', 'ajuste') NOT NULL,
  quantidade INT NOT NULL,
  saldo_anterior INT DEFAULT 0,
  saldo_posterior INT DEFAULT 0,
  descricao VARCHAR(255) NULL,
  stripe_transaction_id VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_created (created_at)
);
```

---

## 2. ALTERAÇÕES NO BACKEND

### 2.1 Estrutura de Arquivos

```
backend/src/
├── controllers/
│   └── WhatsAppController.js  [EXPANDIR - adicionar métodos de usage/buy]
├── services/
│   ├── WhatsAppNotificationService.js    [NOVO]
│   └── WhatsAppUsageService.js           [NOVO]
├── models/
│   ├── WhatsAppUsage.js                  [NOVO]
│   └── WhatsAppCreditsLog.js             [NOVO]
└── routes/
    └── whatsapp.js  [EXPANDIR - adicionar 2 novos endpoints]
```

**Alterações mínimas:**
- Expandir WhatsAppController.js (adicionar 2 métodos)
- Expandir routes/whatsapp.js (adicionar 2 endpoints)
- Criar 2 novos Services
- Criar 2 novos Models
- Nenhuma página nova no frontend

### 2.2 Novos Endpoints (Simplificados)

#### **WhatsApp Usage** (somente leitura)

```
GET /api/whatsapp/usage
Auth: admin/owner
Query: ?barbershopId=1
Return: { 
  used: number,
  limit: number,
  extra_credits: number,
  total_available: number,
  percentage: number,
  can_send: boolean
}
```

#### **WhatsApp Buy Credits** (compra)

```
POST /api/whatsapp/buy-credits
Auth: admin/owner
Body: { barbershopId: number, package: '100'|'300'|'1000' }
Return: { sessionId: string, url: string }
```

**Fluxo:**
1. Frontend chama POST /api/whatsapp/buy-credits
2. Backend cria checkout Stripe (hardcoded packages)
3. Retorna sessionId + URL de checkout
4. Frontend redireciona para Stripe
5. User paga
6. Stripe envia webhook payment_intent.succeeded
7. Backend credita creditos_extra
8. Frontend redirecionado para /admin com success=true

### 2.3 Serviços

#### **WhatsAppNotificationService.js**

```javascript
class WhatsAppNotificationService {
  // Verificar se pode enviar notificação
  static async canSendNotification(barbershopId) {
    // 1. Verificar se WhatsApp está habilitado
    // 2. Verificar se sessão está conectada
    // 3. Verificar se limite não foi atingido
    // Return: { can_send: boolean, reason: string }
  }

  // Determinar se cliente deve receber notificação
  static async shouldNotify(barbershopId, queueId, clientPosition, numBarbers) {
    // Regra: position <= 3 AND position > numBarbers
    // AND notificado_whatsapp = false
    // AND não foi notificado há menos de 5 min
  }

  // Enviar notificação
  static async sendNotification(barbershopId, clientPhone, clientName, position) {
    // 1. Validar phone (formato WhatsApp)
    // 2. Chamar /api/whatsapp/send no WhatsApp service
    // 3. Se sucesso: marcar queue.notificado_whatsapp = true
    // 4. Se sucesso: incrementar whatsapp_usage.notificacoes_enviadas
    // 5. Se sucesso: registrar log em whatsapp_credits_log
    // Return: { success: boolean, error?: string }
  }

  // Hook para ser chamado quando barber chama próximo cliente
  static async notifyIfEligible(barbershopId, queueId) {
    // Integração com QueueService
  }
}
```

#### **WhatsAppUsageService.js**

```javascript
class WhatsAppUsageService {
  // Obter ou criar registro de uso do mês atual
  static async getOrCreateMonthlyUsage(barbershopId) {
    // SELECT * FROM whatsapp_usage 
    // WHERE barbershop_id = ? AND mes_referencia = DATE_FORMAT(CURDATE(),'%Y-%m-01')
    // Se não existe, CREATE
  }

  // Verificar se pode enviar notificação (verificar limite)
  static async canSendMessage(barbershopId) {
    // Obter monthly usage
    // limite_total = limite_mensal + creditos_extra
    // if notificacoes_enviadas >= limite_total return false
  }

  // Incrementar contador de notificações
  static async incrementUsage(barbershopId) {
    // UPDATE whatsapp_usage SET notificacoes_enviadas = notificacoes_enviadas + 1
  }

  // Obter estatísticas de uso
  static async getStats(barbershopId) {
    // Return { used, limit, extra, total, percentage, can_send }
  }

  // Adicionar créditos (após pagamento)
  static async addCredits(barbershopId, quantity, stripeTransactionId) {
    // UPDATE whatsapp_usage SET creditos_extra = creditos_extra + quantity
    // INSERT INTO whatsapp_credits_log
  }

  // Log de uso (auditoria)
  static async logMovement(barbershopId, tipo, quantity, descricao, stripeId?) {
    // INSERT INTO whatsapp_credits_log
  }
}
```

### 2.4 Alterações em Serviços Existentes

#### **QueueService.js**

```javascript
// No método callNextClient, após chamar cliente:
static async callNextClient(barbershopId, barberId) {
  // ... código existente ...
  
  // [NOVO] Verificar se deve enviar notificação WhatsApp
  if (client) {
    try {
      await WhatsAppNotificationService.notifyIfEligible(
        barbershopId, 
        client.id
      );
    } catch (err) {
      console.error('[Queue] Erro ao enviar notificação WhatsApp:', err);
      // Não deve bloquear a chamada do cliente
    }
  }
  
  return client;
}

// No método removeClient:
static async removeClient(queueId, barbershopId) {
  // ... remover cliente ...
  // [NOVO] Resetar notificado_whatsapp se cliente for readicionado
}
```

#### **StripeWebhookController.js**

```javascript
// Adicionar handler para payment_intent.succeeded:
if (event.data.object.metadata?.type === 'whatsapp_credits') {
  const barbershopId = event.data.object.metadata.barbershop_id;
  const creditPackage = event.data.object.metadata.credit_package;
  
  // Mapear package para quantidade
  const quantidades = { '100': 100, '300': 300, '1000': 1000 };
  const quantity = quantidades[creditPackage];
  
  // Adicionar créditos
  await WhatsAppUsageService.addCredits(
    barbershopId,
    quantity,
    event.id
  );
}
```

### 2.5 Alterações em Routes Existentes

**Expandir arquivo existente:** `backend/src/routes/whatsapp.js`

```javascript
// Adicionar 2 novos endpoints:

// GET - Obter uso do mês
router.get('/usage', authMiddleware, WhatsAppController.getUsage);

// POST - Criar checkout Stripe
router.post('/buy-credits', authMiddleware, roleMiddleware(['admin', 'owner']), WhatsAppController.buyCredits);
```

**Expandir WhatsAppController.js:**

```javascript
static async getUsage(req, res) {
  try {
    const { barbershopId } = req.query;
    
    if (!barbershopId) {
      return res.status(400).json({ error: 'barbershopId é obrigatório' });
    }
    
    const stats = await WhatsAppUsageService.getStats(barbershopId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter uso' });
  }
}

static async buyCredits(req, res) {
  try {
    const { barbershopId, package } = req.body;
    
    if (!barbershopId || !['100', '300', '1000'].includes(package)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }
    
    const { sessionId, url } = await WhatsAppUsageService.createCheckout(
      barbershopId,
      package
    );
    
    res.json({ sessionId, url });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar checkout' });
  }
}
```

---

## 3. ALTERAÇÕES NO PAINEL (Frontend)

### 3.1 KPI no Dashboard Existente

**No painel do estabelecimento** (`/admin`), adicionar Card:

```
┌─────────────────────────────────┐
│  Notificações WhatsApp          │
├─────────────────────────────────┤
│  [████████░░░░░░░░░░░░░░░░░░]   │
│  412 / 500 notificações usadas  │
│  88 créditos extras             │
│                                 │
│  [Comprar mais créditos]        │
└─────────────────────────────────┘
```

**Lógica:**
- GET /api/whatsapp/usage?barbershopId=X
- Atualizar a cada 30s ou ao retornar da página
- Desabilitar botão se atingir limite
- Mapa de cores: verde (<50%), amarelo (50-80%), vermelho (>80%)

### 3.2 Modal de Compra de Créditos

**Ao clicar em [Comprar mais créditos]:**

```
┌──────────────────────────────────┐
│  Comprar Notificações WhatsApp   │
├──────────────────────────────────┤
│                                  │
│  [100 notif. → R$10,00]   btn   │
│  [300 notif. → R$20,00]   btn   │
│  [1000 notif. → R$50,00]  btn   │
│                                  │
│          [Cancelar]              │
└──────────────────────────────────┘
```

**Fluxo:**
1. User clica em um pacote
2. POST /api/whatsapp/buy-credits { barbershopId, package: "300" }
3. Recebe { sessionId, url }
4. Redireciona para url do Stripe
5. User paga
6. Webhook credita
7. Redirecionado para /admin?whatsapp=success
8. Modal fecha, stats recarregam

### 3.3 Componentes Mínimos

```typescript
// src/components/WhatsAppUsageCard.tsx
// Mostra card de uso com barra de progresso

// src/components/BuyCreditsModal.tsx
// Modal simples com 3 botões de pacotes + lógica de checkout

// src/hooks/useWhatsAppUsage.ts
// Hook para GET /api/whatsapp/usage com cache/refetch
```

**Nenhuma página nova** - tudo integrado no `/admin` existente.

---

## 4. FLUXO DE COMPRA DE CRÉDITOS

### 4.1 Sequência Completa

```
PAINEL (Frontend)
    ↓
[Botão "Comprar +300 notificações → R$20,00"]
    ↓
POST /api/whatsapp/credits/checkout
  {
    barbershopId: 1,
    package: "300"
  }
    ↓
WhatsAppCreditsController.checkout()
  1. Validar barbershopId (ownership)
  2. Criar checkout Stripe:
     {
       payment_method_types: ["card"],
       line_items: [{
         price_data: {
           currency: "brl",
           product_data: { name: "300 Notificações WhatsApp" },
           unit_amount: 2000 // R$20,00
         },
         quantity: 1
       }],
       metadata: {
         type: "whatsapp_credits",
         barbershop_id: 1,
         credit_package: "300"
       },
       success_url: "https://filalivre.app.br/admin/whatsapp?success=true",
       cancel_url: "https://filalivre.app.br/admin/whatsapp?cancelled=true"
     }
  3. Return { sessionId, clientSecret }
    ↓
Painel redireciona para Stripe Checkout
    ↓
USER paga
    ↓
Stripe envia webhook: payment_intent.succeeded
    ↓
StripeWebhookController.handle()
  1. Verificar assinatura do webhook
  2. if event.type === "payment_intent.succeeded"
        && metadata.type === "whatsapp_credits"
  3. WhatsAppUsageService.addCredits(
       barbershop_id: 1,
       quantity: 300,
       stripeId: "pi_123456"
     )
  4. UPDATE whatsapp_usage SET creditos_extra += 300
  5. INSERT whatsapp_credits_log
    ↓
Painel (sucesso) mostra confirmação
    ↓
Stats auto-atualizam: "412 / 800 usadas"
```

### 4.2 Transações Stripe

**Produtos para criar manualmente ou via API:**

```javascript
const packages = [
  {
    id: 'whatsapp_100',
    name: '100 Notificações WhatsApp',
    amount: 1000, // R$10,00
    currency: 'brl'
  },
  {
    id: 'whatsapp_300',
    name: '300 Notificações WhatsApp',
    amount: 2000, // R$20,00
    currency: 'brl'
  },
  {
    id: 'whatsapp_1000',
    name: '1000 Notificações WhatsApp',
    amount: 5000, // R$50,00
    currency: 'brl'
  }
];
```

---

## 5. PLANO DE IMPLEMENTAÇÃO (PASSO A PASSO)

### **FASE 1: Database + Backend Básico** (2-3 horas)

- [ ] Criar migration para tabela `whatsapp_usage`
- [ ] Criar migration para tabela `whatsapp_credits_log`
- [ ] Executar migrations
- [ ] Criar models: `WhatsAppUsage.js`, `WhatsAppCreditsLog.js`
- [ ] Criar service: `WhatsAppUsageService.js`
- [ ] Testes em banco: INSERT com mes_referencia, verificar constraints

**Checkpoint:** Banco de dados pronto, dados testavéis via SQL

---

### **FASE 2: Lógica de Notificações** (3-4 horas)

- [ ] Criar `WhatsAppNotificationService.js`
- [ ] Implementar `canSendNotification()`
- [ ] Implementar `shouldNotify()` com lógica de posição
- [ ] Implementar `sendNotification()` com chamada para /api/whatsapp/send
- [ ] Alterar `QueueService.callNextClient()` para chamar `notifyIfEligible()`
- [ ] Adicionar campo `notificado_whatsapp` em Queue model
- [ ] Testes: Simular fila com clientes, verificar quando notificação é enviada

**Checkpoint:** Notificações sendo enviadas automaticamente quando condição é atendida

---

### **FASE 3: Endpoints de Notificações** (2 horas)

- [ ] Criar controller: `WhatsAppNotificationController.js`
- [ ] Criar routes: `whatsapp-notifications.js`
- [ ] Implementar GET `/api/whatsapp/notifications/stats/:barbershopId`
- [ ] Implementar GET `/api/whatsapp/notifications/usage-log/:barbershopId`
- [ ] Implementar POST `/api/whatsapp/notifications/notify` (endpoint interno)
- [ ] Implementar PATCH `/api/whatsapp/notifications/limits/:barbershopId` (admin)
- [ ] Testes com curl: Verificar stats, logs, limite

**Checkpoint:** Backend completo, pronto para consumir do frontend

---

### **FASE 4: Integração Stripe (Credits)** (2-3 horas)

- [ ] Criar controller: `WhatsAppCreditsController.js`
- [ ] Criar routes: `whatsapp-credits.js`
- [ ] Implementar GET `/api/whatsapp/credits/packages`
- [ ] Implementar POST `/api/whatsapp/credits/checkout`
- [ ] Alterar `StripeWebhookController.js` para processar webhook de créditos
- [ ] Implemetar `WhatsAppUsageService.addCredits()`
- [ ] Testes: Simular pagamento Stripe, verificar creditos_extra atualizado

**Checkpoint:** Sistema de compra funcional end-to-end

---

### **FASE 5: Frontend - Dashboard** (4-5 horas)

- [ ] Criar página `/admin/whatsapp`
- [ ] Criar componentes: UsageProgress, PriceTable, BuyButton
- [ ] Criar hook: `useWhatsAppUsage()`
- [ ] Criar service: `whatsappCreditsService.ts`
- [ ] Integrar com Stripe Checkout
- [ ] Testes: Verificar display de stats, compra de pacotes

**Checkpoint:** Painel completo e funcional

---

### **FASE 6: Monitoramento e Ajustes** (1-2 horas)

- [ ] Adicionar logs detalhados
- [ ] Criar alertas (ex: quando atingir 80% do limite)
- [ ] Testes E2E: Cliente na fila → notificação → compra de créditos
- [ ] Documentação interna (comentários em código)

**Checkpoint:** Tudo pronto para produção

---

## 6. ÍNDICES E OTIMIZAÇÕES

```sql
-- Índices essenciais já mapeados nas CREATE TABLE

-- Queries críticas a otimizar:
-- 1. getOrCreateMonthlyUsage(): INDEX (barbershop_id, mes_referencia)
-- 2. getQueueByPosition(): INDEX (barbershop_id, position)
-- 3. whatsapp_credits_log: INDEX (barbershop_id) para histórico
```

---

## 7. VALIDAÇÕES E SEGURANÇA

### Backend
- ✓ Verificar ownership de barbershop antes de qualquer operação
- ✓ Validar phone format (WhatsApp aceita +55 11 9 8888-8888)
- ✓ Throttling: Max 10 notificações por segundo por barbershop
- ✓ Limpar creditos_extra = 0 se mês novo NÃO foi atingido
- ✓ Webhook Stripe: Validar assinatura

### Frontend
- ✓ Desabilitar botão quando limite é atingido
- ✓ Confirmar compra antes de Stripe Checkout
- ✓ Mostrar loading states durante requisições
- ✓ Tratar erros de rede com retry

---

## 8. ROLLBACK PLAN

Se algo der errado:

```bash
# Remover field:
ALTER TABLE queue DROP COLUMN notificado_whatsapp;

# Desabilitar notificações:
UPDATE barbershops SET whatsapp_enabled = FALSE;

# Reverter webhook:
# Comentar código de credits em StripeWebhookController.js

# Limpar dados:
DROP TABLE whatsapp_usage;
DROP TABLE whatsapp_credits_log;
```

---

## 9. MÉTRICAS DE SUCESSO

- [ ] Notificações sendo enviadas quando cliente está próximo
- [ ] Limite respeitado (não envia após atingir)
- [ ] Compra de créditos funcional via Stripe
- [ ] Dashboard mostrando stats corretos
- [ ] Sem erros em logs
- [ ] Performance: 0% impacto em filas

---

## Próximos Passos

Aguardando confirmação para iniciar **FASE 1** (Database).

Deseja que eu proceda com a implementação?
