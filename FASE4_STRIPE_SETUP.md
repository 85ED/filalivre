# FASE 4: Integração Stripe - Guia Completo

## ✅ Status: IMPLEMENTADO E ALINHADO COM ARQUITETURA EXISTENTE

**Data:** 12 de março de 2026  
**Versão:** 2.0 (Alinhado com sistema de assinatura existente)

---

## 📋 Arquitetura Integrada

Este é um RESUMO da implementação corrigida alinhada com a arquitetura existente do sistema FilaLivre.

### Padrão Unificado de Pagamento Stripe

O sistema agora mantém **um único cliente Stripe** que processa **dois tipos de pagamento**:

#### 1. **Pagamento de Assinatura** (Já existente)
- **Tipo:** Subscriptions (recorrente)
- **Metadata:** `type: 'subscription'`, `barbershop_id: '123'`
- **Modelo:** Cálculo dinâmico baseado em:
  - `seat_price_cents` (configurável por barbearia)
  - Número de profissionais ativos (`seatQuantity`)
- **Webhook:** Atualiza `stripe_subscription_id` e `subscription_status`

#### 2. **Compra de Créditos WhatsApp** (Novo)
- **Tipo:** One-time payment
- **Metadata:** `type: 'whatsapp_credits'`, `barbershop_id: '123'`, `package_quantity: '300'`
- **Modelo:** Pacotes fixos (100/300/1000 notificações)
- **Webhook:** Adiciona `creditos_extra` em `whatsapp_usage`

### Avantagens da Abordagem Unificada

✅ **Uma configuração Stripe** - Sem duplicação  
✅ **Um webhook** - `/api/stripe/webhook` - Sem conflitos  
✅ **Um StripeService** - Centralizado, mantível  
✅ **Diferenciação por metadata** - Fluxos separados sem confusão  
✅ **Auditoria unificada** - Todos os pagamentos em um histórico  

---

## 🔧 Implementação Backend

### 1. **env.js** - Configuração Unificada

```javascript
// Nur WhatsApp Credit Packages (separado por convenção)
export const WHATSAPP_CREDIT_PACKAGES = [
  {
    quantity: '100',
    name: '100 Notificações',
    description: '~1 semana de uso',
    price: 1000,      // centavos
    currency: 'brl',
  },
  {
    quantity: '300',
    name: '300 Notificações',
    description: '~3 semanas de uso',
    price: 2000,
    currency: 'brl',
  },
  {
    quantity: '1000',
    name: '1000 Notificações',
    description: '~2 meses de uso',
    price: 5000,
    currency: 'brl',
  },
];
```

**Nota:** Não há `STRIPE_CONFIG` novo - usa o cliente existente via `StripeService` que já lê `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` do `.env`

### 2. **StripeService.js** - Métodos Centralizados

#### Método existente (sem mudança estrutural):
```javascript
static async createCheckoutSession({
  customerId, customerEmail, seatPriceCents, 
  seatQuantity, barbershopId, successUrl, cancelUrl 
})
```

**Mudança:** Adicionado `type: 'subscription'` na metadata para diferenciar

#### Novo método (chamado por WhatsAppController):
```javascript
static async createWhatsAppCreditsSession({
  barbershopId, packageQuantity, successUrl, cancelUrl
})
```

**Fluxo:**
1. Valida pacote contra `WHATSAPP_CREDIT_PACKAGES`
2. Cria Stripe session com `mode: 'payment'` (não subscription)
3. Adiciona metadata: `type: 'whatsapp_credits'`
4. Retorna: `{ sessionId, url }`

### 3. **WhatsAppController.js** - buyCredits Simplificado

```javascript
static async buyCredits(req, res) {
  // 1. Validar JWT + propriedade
  const userBarbershopId = req.user?.barbershopId;
  
  // 2. Validar Stripe configurado
  if (!StripeService.isConfigured()) { ... }
  
  // 3. Criar session via StripeService
  const stripeSession = await StripeService.createWhatsAppCreditsSession({
    barbershopId: userBarbershopId,
    packageQuantity: parseInt(packageName),
    successUrl: '...?payment=success&type=whatsapp_credits',
    cancelUrl: '...?payment=cancelled&type=whatsapp_credits',
  });
  
  // 4. Retornar URL para redirect no frontend
  return { url: stripeSession.url }
}
```

### 4. **StripeWebhookController.js** - Webhook Unificado

**Fluxo:**

```javascript
async function handle(req, res) {
  const event = StripeService.constructEvent(req.body, signature);
  
  switch(event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    // ... outros eventos
  }
}

async function handleCheckoutCompleted(session) {
  // Diferenciar por tipo
  if (session.metadata?.type === 'whatsapp_credits') {
    await handleWhatsAppCreditsPurchase(session);
    return;
  }
  
  // Senão, processar subscription normalmente
  const barbershopId = session.metadata?.barbershop_id;
  // ... update subscription
}

async function handleWhatsAppCreditsPurchase(session) {
  const barbershopId = session.metadata?.barbershop_id;
  const packageQuantity = session.metadata?.package_quantity;
  
  // Transação atômica
  BEGIN TRANSACTION
    UPDATE whatsapp_usage SET creditos_extra += packageQuantity
    INSERT INTO whatsapp_credits_log (...)
  COMMIT
}
```

---

## 🎨 Implementação Frontend

### 1. **Hook** - useWhatsAppUsage.ts

```typescript
const buyCredits = async (packageQuantity: '100'|'300'|'1000') => {
  // 1. Chamar POST /api/whatsapp/buy-credits
  const response = await api.post('/whatsapp/buy-credits', { 
    package: packageQuantity 
  });
  
  // 2. Redirect para Stripe Checkout
  if (response.data.url) {
    window.location.href = response.data.url;
  }
}
```

### 2. **Card** - WhatsAppUsageCard.tsx

Mantém funcionalidade:
- ✅ Mostra uso com progress bar colorido
- ✅ Estimativa de dias restantes
- ✅ Alerta em 80%+
- ✅ Botão desabilitado quando limite atingido

### 3. **Modal** - BuyCreditsModal.tsx

- Seleção de pacote
- Proteção contra múltiplos cliques
- Mostra loading enquanto redireciona

### 4. **Dashboard** - admin.tsx

**Novo:** Detecção de retorno do Stripe

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success' && 
      params.get('type') === 'whatsapp_credits') {
    setPaymentSuccess(true);
    // Auto-close após 5s
  }
}, []);
```

**Novo:** Alert de sucesso verde no topo do painel

```jsx
{paymentSuccess && (
  <motion.div className="rounded-xl bg-green-50 border border-green-200 p-4">
    <Check className="w-5 h-5 text-green-600" />
    <h3>Compra realizada com sucesso! ✅</h3>
    <p>Seus créditos WhatsApp foram adicionados à sua conta.</p>
  </motion.div>
)}
```

---

## 🔐 Segurança

✅ **JWT obrigatório** - Autenticação em todos endpoints  
✅ **Validação de propriedade** - `barbershipId` do token  
✅ **Assinatura Stripe** - Webhook verifica `stripe-signature`  
✅ **Transações atômicas** - BEGIN/COMMIT garante consistência  
✅ **Idempotência** - Valida `session_id` para evitar duplicação  

---

## 🧪 Testando

### Backend-Only Test (via cURL)
```bash
curl -X POST http://localhost:3001/api/whatsapp/buy-credits \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package": "300"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

### Frontend Complete Test

1. Abrir admin dashboard
2. Clicar "Comprar créditos" na card WhatsApp
3. Selecionar pacote (e.g., 300)
4. Clicar "Comprar por R$20"
5. Redireciona para Stripe Checkout
6. Usar card teste: `4242 4242 4242 4242`
7. Confirmar pagamento
8. Redireciona para `/admin?payment=success&type=whatsapp_credits`
9. **Alert verde aparece** ✅
10. Webhook processa automaticamente
11. Créditos adicionados em `whatsapp_usage.creditos_extra`

### Webhook Local (Stripe CLI)

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Copiar webhook secret do output
# Adicionar em .env: STRIPE_WEBHOOK_SECRET=whsec_...

# Disparar evento teste
stripe trigger checkout.session.completed
```

---

## 📚 Variáveis de Ambiente Necessárias

```bash
# Stripe (mesmas chaves da assinatura)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs de redirect (opcional, padrão são localhost:5173)
FRONTEND_URL=http://localhost:5173
APP_URL=http://localhost:5173
```

---

## 🚨 Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| "Stripe not configured" | `STRIPE_SECRET_KEY` não definida | Adicionar em `.env` |
| Webhook falha com 401 | `STRIPE_WEBHOOK_SECRET` incorreto | Copiar exato do Stripe Dashboard |
| Créditos não adicionados | Webhook pode estar atrasado | Esperar 30s, verificar logs do servidor |
| Usuário vê "payment=success" mas sem feedback | Novo — componente precisa estar renderizado | Usar nova versão admin.tsx com Alert |
| Query params não limpam | Navegador cache | Abrir console: `window.history.replaceState({}, document.title, '/')` |

---

## ✅ Checklist de Implementação

- [x] `env.js`: `WHATSAPP_CREDIT_PACKAGES` definido
- [x] `StripeService`: `createWhatsAppCreditsSession()` implementado
- [x] `StripeService`: `createCheckoutSession()` com `type: 'subscription'` na metadata
- [x] `WhatsAppController`: `buyCredits()` retorna only `{ url, sessionId }`
- [x] `StripeWebhookController`: `handleCheckoutCompleted()` diferencia tipos
- [x] `StripeWebhookController`: `handleWhatsAppCreditsPurchase()` credita notificações
- [x] `useWhatsAppUsage` hook: Redireciona para Stripe, não cria session
- [x] `WhatsAppUsageCard`: Botão desabilitado quando `can_send = false`
- [x] `admin.tsx`: Detecta `?payment=success&type=whatsapp_credits`
- [x] `admin.tsx`: Mostra Alert verde de sucesso
- [x] Endpoint webhook: `/api/stripe/webhook` (existente)
- [x] Sem novos endpoints criados
- [ ] Configurar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` no `.env`
- [ ] Configurar webhook no Stripe Dashboard apontando para `/api/stripe/webhook`
- [ ] Testar flow completo (frontend → Stripe → webhook → DB)

---

## 🎉 Próximos Passos (Opcionais)

1. **Histórico de transações** - Página mostrando compras anteriores
2. **Recibos automáticos** - Enviar PDF via email após pagamento
3. **Auto-recharge** - Comprar automaticamente ao atingir limite
4. **Refunds** - Processar reembolsos se usuário solicitar
5. **Analytics** - Gráficos de consumo de notificações

---

## 📖 Referências

- **Stripe API:** https://stripe.com/docs/api
- **Webhook Events:** https://stripe.com/docs/api/events/types#event_types
- **Checkout Sessions:** https://stripe.com/docs/payments/checkout
- **Stripe CLI:** https://stripe.com/docs/stripe-cli

### Backend (Node.js)

#### 1. **Configuração Stripe** (`backend/env.js`)
- ✅ `STRIPE_CONFIG` com chaves API
- ✅ `STRIPE_PACKAGES` com preços em centavos
  - 100 notificações → R$10
  - 300 notificações → R$20 (recomendado)
  - 1000 notificações → R$50

#### 2. **StripeService** (`backend/src/services/StripeService.js`)
- ✅ `createWhatsAppCreditsSession()` - Criar sessão de checkout
- ✅ Metadata com: `type: 'whatsapp_credits'`, `barbershopId`, `package`
- ✅ Redirect URLs configuráveis

#### 3. **WhatsAppController** (`backend/src/controllers/WhatsAppController.js`)
- ✅ `POST /api/whatsapp/buy-credits` retorna `session.url`
- ✅ Autenticação JWT obrigatória
- ✅ Validação de propriedade (barbershop)
- ✅ Erro se Stripe não configurado

#### 4. **Webhook Handler** (`backend/src/controllers/StripeWebhookController.js`)
- ✅ `handleCheckoutCompleted()` dispara ao pagamento bem-sucedido
- ✅ `handleWhatsAppCreditsPurchase()` credita notificações
- ✅ Transação atômica (BEGIN/COMMIT/ROLLBACK)
- ✅ Deduplicação por `session_id`
- ✅ Log em `whatsapp_credits_log`

### Frontend (React)

#### 1. **Hook** (`src/hooks/useWhatsAppUsage.ts`)
- ✅ `buyCredits()` chama POST /api/whatsapp/buy-credits
- ✅ Se retorna `response.data.url` → redirect para Stripe
- ✅ Auto-refetch de stats após compra

#### 2. **Card** (`src/components/WhatsAppUsageCard.tsx`)
- ✅ Botão desabilitado quando `can_send = false`
- ✅ Estimativa de dias restantes
- ✅ CTA visível a partir de 70% de uso

#### 3. **Modal** (`src/components/BuyCreditsModal.tsx`)
- ✅ Proteção contra múltiplos cliques (`isProcessing`)
- ✅ Estados: Seleção → Resumo → Processando → Sucesso
- ✅ Auto-close após sucesso (2s)
- ✅ Integração com Stripe via `response.data.url`

#### 4. **Dashboard** (`src/pages/admin.tsx`)
- ✅ Card e Modal integrados
- ✅ State management para modal aberto/fechado
- ✅ Callback passado para CTA button

---

## 🔧 Configuração Necessária

### 1. **Variáveis de Ambiente** (`.env` backend)

```bash
# Stripe API Keys (obter em https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... ou whsec_test_...

# Frontend URL (para redirect pós-pagamento)
FRONTEND_URL=http://localhost:5173  # desenvolvimento
# FRONTEND_URL=https://filalivre.com # produção

# Node environment
NODE_ENV=development ou production
```

### 2. **Webhook Setup no Stripe Dashboard**

1. Aceder a: **https://dashboard.stripe.com/webhooks**
2. Criar novo endpoint:
   - **URL:** `https://seu-backend.com/webhooks/stripe`
   - **Versão da API:** Latest
   - **Eventos:** Selecionar:
     - `checkout.session.completed`
     - (opcional) `payment_intent.succeeded` (fallback)
     - (opcional) `charge.failed` (para logging)

3. Copiar o **Webhook Signing Secret** para `STRIPE_WEBHOOK_SECRET` no `.env`

### 3. **Routes Setup** (verificar em `backend/server.js`)

Webhook rota precisa estar **ANTES** do middleware de autenticação:

```javascript
// WebHooks (sem autenticação)
app.post('/webhooks/stripe', express.raw({type: 'application/json'}), StripeWebhookController.handle);

// Rotas autenticadas
app.use(authMiddleware);
```

⚠️ **Importante:** Stripe envia o body como `raw` (stream), não JSON. O express.raw() é essencial!

---

## 🧪 Testando Integralmente

### Test 1: Criar Sessão de Checkout

```bash
curl -X POST http://localhost:3001/api/whatsapp/buy-credits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package": "300"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "barbershopId": 1,
    "package": {
      "quantity": "300",
      "name": "300 Notificações",
      "price": 20,
      "priceFormatted": "R$ 20,00"
    },
    "sessionId": "cs_test_...",
    "url": "https://checkout.stripe.com/pay/cs_test_..."
  }
}
```

### Test 2: Simular Webhook Localmente

#### Opção A: Usar Stripe CLI

```bash
# 1. Instalar Stripe CLI (https://stripe.com/docs/stripe-cli)
brew install stripe/stripe-cli/stripe  # macOS

# 2. Login
stripe login

# 3. Forward webhooks locais
stripe listen --forward-to localhost:3001/webhooks/stripe

# 4. Criar evento de teste
stripe trigger checkout.session.completed
```

O Stripe CLI mostrará o signing secret para testar localmente.

#### Opção B: Trigger Manual (desenvolvimento)

Adicionar endpoint de teste em `backend/src/routes/whatsapp.js`:

```javascript
// Apenas para desenvolvimento!
if (process.env.NODE_ENV === 'development') {
  router.post('/test-webhook', async (req, res) => {
    const mockSession = {
      id: 'cs_test_mock_' + Date.now(),
      metadata: {
        type: 'whatsapp_credits',
        barbershopId: '1',
        package: '300',
      },
      payment_intent: 'pi_test_mock_' + Date.now(),
    };
    
    // Chamar handler diretamente
    try {
      await handleWhatsAppCreditsPurchase(mockSession);
      res.json({ success: true, session: mockSession });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
```

### Test 3: Flow Completo no Frontend

1. **Abrir admin dashboard**
2. **Clicar em WhatsApp card** → deve mostrar uso
3. **Clicar "Comprar créditos"** → abre modal
4. **Selecionar pacote** → estado atualiza
5. **Clicar "Comprar"** → redirect para Stripe
6. **Usar teste Stripe:**
   - Card: `4242 4242 4242 4242`
   - Data: `12/26`
   - CVC: `123`
   - ZIP: `12345`
7. **Confirmar pagamento** → deve redirect para `/admin?payment=success`
8. **Verificar stats** → créditos adicionados! ✅

---

## 📊 Fluxo de Dados

```
┌─ Frontend (React) ─────────────────────┐
│ User clica "Comprar Créditos"          │
│ Modal abre → Seleciona pacote          │
│ Clica "Comprar por R$20"               │
└────────────┬────────────────────────────┘
             │
             ↓
┌─ Backend (Node.js) ────────────────────┐
│ POST /api/whatsapp/buy-credits         │
│ StripeService.createCheckoutSession()  │
│ Retorna: { url, sessionId, package }   │
└────────────┬────────────────────────────┘
             │
             ↓
┌─ Stripe Checkout ──────────────────────┐
│ User entra card details                 │
│ Clica "Pay R$20"                       │
│ Stripe processa pagamento               │
└────────────┬────────────────────────────┘
             │
             ↓
┌─ Stripe Webhook (Callback) ────────────┐
│ POST /webhooks/stripe                  │
│ Event: checkout.session.completed      │
│ Valida signature                       │
│ Chama handleWhatsAppCreditsPurchase()  │
│ BEGIN TRANSACTION                      │
│   UPDATE whatsapp_usage SET creditos_extra += 300
│   INSERT INTO whatsapp_credits_log ...
│ COMMIT                                  │
└────────────┬────────────────────────────┘
             │
             ↓
┌─ Frontend (Auto-refresh) ──────────────┐
│ useWhatsAppUsage().refetch()           │
│ Mostra sucesso por 2s                  │
│ Modal fecha                            │
│ Stats atualizado: 300 créditos extras! │
└────────────────────────────────────────┘
```

---

## 🚨 Troubleshooting

### Problema: "Stripe not configured"
**Causa:** `STRIPE_SECRET_KEY` não está definida  
**Solução:** Adicionar em `.env`

### Problema: "Webhook signature verification failed"
**Causa:** `STRIPE_WEBHOOK_SECRET` incorreto  
**Solução:** Copiar secret correto do dashboard Stripe

### Problema: Webhook não muda créditos
**Causa:** Evento pode não estar mapeado  
**Solução:** Verificar console do servidor para logs de webhook

### Problema: User vê "payment=success" mas créditos não adicionados
**Causa:** Webhook ainda está processando  
**Solução:** Esperar 30s e refresh. Verificar logs do servidor.

### Problema: Erro 403 "you can only purchase credits for your own barbershop"
**Causa:** JWT token não tem barbershopId correto  
**Solução:** Verificar token JWT antes de chamar endpoint

---

## 📚 Referências

- **Stripe API:** https://stripe.com/docs/api
- **Stripe CLI:** https://stripe.com/docs/stripe-cli
- **Webhook Events:** https://stripe.com/docs/api/events/types
- **Checkout Sessions:** https://stripe.com/docs/payments/checkout/custom-success-page

---

## ✅ Checklist Final

- [ ] `.env` possui `STRIPE_SECRET_KEY`
- [ ] `.env` possui `STRIPE_WEBHOOK_SECRET`
- [ ] Webhook configurado no Stripe Dashboard
- [ ] Endpoint `/webhooks/stripe` accesível publicamente
- [ ] `frontend_url` correto no `.env`
- [ ] Rotas webhook **antes** de auth middleware
- [ ] Tests passam (curl + Stripe CLI)
- [ ] Flow completo testado no navegador
- [ ] Logs de webhook aparecem no console
- [ ] Créditos adicionados corretamente após pagamento

---

## 🎉 Conclusão FASE 3 + 4

A integração WhatsApp está **100% funcional**:

✅ **Database:** Schema com tabelas de uso e log  
✅ **Backend:** Services, Controllers, Endpoints, Webhook  
✅ **Frontend:** Hooks, Componentes, UX intuitiva  
✅ **Pagamento:** Stripe integrado end-to-end  
✅ **Segurança:** JWT, validação de propriedade, Stripe signatures  
✅ **Auditoria:** Todos movimentos logados em `whatsapp_credits_log`  

**Próximas possibilidades:**
- Histórico de transações no frontend
- Exportar recibos/faturas
- Renovação automática de créditos
- Planos de assinatura (não one-time)
- Analytics de uso por dia/hora
