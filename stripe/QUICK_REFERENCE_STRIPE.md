# Quick Reference - Guia Rápido Stripe Subscriptions

**Documento de Bolso - Referência Rápida**

---

## ⚡ COMANDOS ESSENCIAIS

### Stripe CLI (Sandbox)
```bash
# Escutar webhooks localmente
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Disparar evento de teste
stripe trigger checkout.session.completed

# Ver eventos recentes
stripe events list

# Validar webhook secret
stripe trigger --help
```

### NPM
```bash
npm install stripe                 # SDK Stripe
npm install dotenv                 # Env vars
npm install redis                  # (opcional) idempotência
npm install express-rate-limit    # (opcional) rate limiting
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

```env
# Sandbox
STRIPE_SECRET_KEY=sk_test_xxx...
STRIPE_WEBHOOK_SECRET=whsec_test_xxx...

# Produção
STRIPE_SECRET_KEY=sk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_live_xxx...

# Fallback (rotação)
STRIPE_WEBHOOK_SECRET_MIN=whsec_test_yyy...

# Geral
STRIPE_API_VERSION=2024-12-18
APP_URL=http://localhost:3000 (ou https://dominio.com)
NODE_ENV=development|production
```

---

## 📊 ESTADOS E TRANSIÇÕES

```
TRIAL (7 dias)
  ↓ Usuário clica "Ativar"
ATIVA (renovação automática)
  ↓ Pagamento falha
PENDENTE (bloqueado)
  ↓ Usuário atualiza cartão
ATIVA (desbloqueado)
  
--- OU ---

ATIVA
  ↓ Cancelamento
CANCELADA (bloqueado)
  ↓ Reativar
[volta ao início]
```

---

## 🔧 ESTRUTURA BANCO DE DADOS (MÍNIMO)

```sql
-- Adicionar em tabela de organização/empresa
ALTER TABLE organizacao ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE organizacao ADD COLUMN stripe_subscription_id VARCHAR(255);
ALTER TABLE organizacao ADD COLUMN assinatura_status ENUM('trial','ativa','pendente','cancelada');
ALTER TABLE organizacao ADD COLUMN ativo TINYINT(1) DEFAULT 1;
ALTER TABLE organizacao ADD INDEX idx_stripe_customer (stripe_customer_id);
ALTER TABLE organizacao ADD INDEX idx_stripe_subscription (stripe_subscription_id);

-- Criar tabela de planos
CREATE TABLE plano_plataforma (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(80) UNIQUE,
  limite_min INT, 
  limite_max INT,
  valor_mensal DECIMAL(10,2),
  ativo BOOLEAN DEFAULT 1,
  INDEX idx_ativos (ativo)
);
```

---

## 🎯 ENDPOINTS (MÍNIMO)

| Método | Rota | Função | Request |
|--------|------|--------|---------|
| GET | `/api/assinatura/minha` | Status | `?org_id=1` |
| POST | `/api/assinatura/ativar` | Checkout | `{org_id}` |
| POST | `/api/assinatura/portal` | Portal | `{org_id}` |
| POST | `/api/stripe/webhook` | Webhook | Stripe |

---

## 💳 EVENTOS STRIPE (5 PRINCIPAIS)

| Evento | Dispara quando | Ação |
|--------|---------------|------|
| `checkout.session.completed` | Checkout concluído | Salvar `subscription_id`; status = `ativa` |
| `invoice.payment_succeeded` | Pagamento bem-sucedido | Status = `ativa` (renovação) |
| `invoice.payment_failed` | Falha de pagamento | Status = `pendente`; bloquear |
| `subscription.updated` | Mudança na sub | Atualizar status |
| `subscription.deleted` | Cancelamento | Status = `cancelada`; bloquear |

---

## 🔑 FLUXO MÍNIMO IMPLEMENTAÇÃO

### 1. Service (stripeService.js)
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = {
  getClient() { return stripe; },
  createCustomer({ email, name, metadata }) {
    return stripe.customers.create({ email, name, metadata });
  },
  createSubscriptionCheckout({ customerId, priceAmountCentavos, metadata, successUrl, cancelUrl }) {
    return stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'brl',
          unit_amount: priceAmountCentavos,
          recurring: { interval: 'month' },
          product_data: { name: 'Assinatura FilaLivre' }
        },
        quantity: 1
      }],
      customer: customerId,
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  }
};
```

### 2. Controller (assinaturaController.js)
```javascript
const stripe = require('../services/stripeService').getClient();

async function minha(req, res) {
  const org = await Organizacao.findById(req.query.org_id);
  const ciclo = calcularTrial(org.created_at);
  
  return res.json({
    success: true,
    status: ciclo.emTrial ? 'trial' : 'ativa',
    diasRestantesTrial: ciclo.diasRestantes
  });
}

async function ativar(req, res) {
  const org = await Organizacao.findById(req.body.org_id);
  
  if (!org.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: org.email,
      metadata: { org_id: org.id }
    });
    org.stripe_customer_id = customer.id;
    await org.save();
  }
  
  const session = await stripeService.createSubscriptionCheckout({
    customerId: org.stripe_customer_id,
    priceAmountCentavos: 9900,
    metadata: { org_id: org.id },
    successUrl: 'https://dominio.com/sucesso',
    cancelUrl: 'https://dominio.com/cancelada'
  });
  
  return res.json({ checkout_url: session.url });
}
```

### 3. Webhook (stripeWebhookController.js)
```javascript
async function handle(req, res) {
  const stripe = require('../services/stripeService').getClient();
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, secret);
    
    switch(event.type) {
      case 'checkout.session.completed': {
        const orgId = event.data.object.metadata.org_id;
        const subId = event.data.object.subscription;
        await Organizacao.update(orgId, {
          stripe_subscription_id: subId,
          assinatura_status: 'ativa'
        });
        break;
      }
      case 'invoice.payment_succeeded': {
        const subId = event.data.object.subscription;
        const org = await Organizacao.findBySubscriptionId(subId);
        await org.update({ assinatura_status: 'ativa' });
        break;
      }
      case 'invoice.payment_failed': {
        const subId = event.data.object.subscription;
        const org = await Organizacao.findBySubscriptionId(subId);
        await org.update({ assinatura_status: 'pendente', ativo: false });
        break;
      }
    }
    
    res.json({ received: true });
  } catch(err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
```

### 4. Integração (app.js)
```javascript
// ANTES de express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// APÓS express.json()
app.use(express.json());

// ROTAS
const assinaturaRouter = require('./routes/assinatura');
app.use('/api/assinatura', assinaturaRouter);

// WEBHOOK
const { handle } = require('./controllers/stripeWebhookController');
app.post('/api/stripe/webhook', handle);
```

---

## 🧪 TESTE RÁPIDO (5 MIN)

```bash
# 1. Setup
npm install stripe
echo "STRIPE_SECRET_KEY=sk_test_xxx" > .env

# 2. Rodar
npm start

# 3. Em outro terminal
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 4. Disparar teste
stripe trigger checkout.session.completed

# 5. Ver logs
# "Webhook received" deve aparecer no terminal
```

---

## ⚠️ ERROS COMUNS

| Erro | Causa | Solução |
|------|-------|---------|
| "Invalid signature" | Secret errado | Copiar correto de `stripe listen` |
| "Resource not found" | Subscription ID errado. BD dessincronizado | Verificar BD, sincronizar manualmente |
| "Invalid request" | Faltam campos obrigatórios | Verificar `metadata`, `customer_id` |
| "Rate limit" | Muitas requisições | Adicionar exponential backoff |

---

## 📋 CHECKLIST MÍNIMO PRODUÇÃO

- [ ] `.env` com `sk_live_xxx` e `whsec_live_xxx`
- [ ] Webhook registrado em Dashboard (https://dominio.com/api/stripe/webhook)
- [ ] HTTPS habilitado
- [ ] Teste de webhook delivery sucesso
- [ ] Rate limiting ativo
- [ ] Logging habilitado (sem secrets)
- [ ] Alertas email/Slack configurados

---

## 🔍 DEBUG RÁPIDO

```javascript
// Verificar status BD vs Stripe
app.get('/api/stripe/debug/:org_id', async (req, res) => {
  const org = await Organizacao.findById(req.params.org_id);
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  if (!org.stripe_subscription_id) {
    return res.json({ status: 'sem_sub' });
  }
  
  const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  
  return res.json({
    async_in_db: org.assinatura_status,
    status_in_stripe: sub.status,
    match: org.assinatura_status === (sub.status === 'active' ? 'ativa' : 'pendente')
  });
});

// Sincronizar
app.post('/api/stripe/sync/:org_id', async (req, res) => {
  const org = await Organizacao.findById(req.params.org_id);
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  
  await org.update({
    assinatura_status: sub.status === 'active' ? 'ativa' : 'pendente'
  });
  
  return res.json({ synced: true });
});
```

---

## 📞 REFERÊNCIAS

- **Documentos internos:** 
  - ARQUITETURA_STRIPE_COMPLETA.md (conceitos)
  - GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md (código)
  - CASOS_USO_TROUBLESHOOTING_STRIPE.md (debug)
  - INDICE_GERAL_DOCUMENTACAO_STRIPE.md (navegação)

- **Oficiais:**
  - stripe.com/docs (API reference)
  - stripe.com/docs/webhooks (webhooks)
  - github.com/stripe/stripe-cli (CLI)

---

## ✨ ATALHOS FREQUENTES

```javascript
// Constants
const DIAS_TRIAL = 7;
const INTERVALO_RENOVACAO = 30; // dias
const MOEDA = 'brl';
const ENV = process.env.NODE_ENV || 'development';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

// Calcular trial
function calcularTrial(createdAt) {
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 86400000);
  return {
    emTrial: diff < 7,
    diasRestantes: Math.max(0, 7 - diff)
  };
}

// Converter para centavos (Stripe)
const centavos = Math.round(valor * 100);

// De centavos para reais
const reais = centavos / 100;

// Formatar data BR
new Date().toLocaleDateString('pt-BR');
```

---

## 🎓 ORDEM DE APRENDIZADO

1. **Conceitos (30min):** Leia este documento
2. **Arquitetura (1h):** ARQUITETURA_STRIPE_COMPLETA.md § 1-3
3. **Código (2h):** GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md § 3
4. **Prática (1h):** Teste com Stripe CLI
5. **Casos (30min):** CASOS_USO_TROUBLESHOOTING_STRIPE.md § 1
6. **Pronto!** 👍

---

**Criado em março 2026 | Última atualização: 09/03/2026**
