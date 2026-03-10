# Guia Prático: Replicando Stripe Subscriptions em FilaLivre

**Documento Complementar - Arquitetura Stripe Guia de Corrida**

---

## ÍNDICE

1. [Setup Inicial](#1-setup-inicial)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Códigos Prontos para Copiar](#3-códigos-prontos)
4. [Fluxo Passo-a-Passo](#4-fluxo-passo-a-passo)
5. [Testes End-to-End](#5-testes-end-to-end)

---

## 1. SETUP INICIAL

### Dependências NPM

```bash
npm install stripe
npm install dotenv
```

### Variáveis de Ambiente (`.env`)

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_123abc...
STRIPE_WEBHOOK_SECRET=whsec_test_abc...
STRIPE_WEBHOOK_SECRET_MIN=whsec_test_min...
STRIPE_API_VERSION=2024-12-18

# URLs
APP_URL=http://localhost:3000
NODE_ENV=development

# Auth
INTERNAL_AUTH_TOKEN=fila_internal_2024
```

---

## 2. ESTRUTURA DE PASTAS

```
FilaLivre/
├── src/
│   ├── config/
│   │   └── database.js          (pool MySQL já existe)
│   ├── models/
│   │   ├── assinaturaModel.js   (NOVO)
│   │   └── planoModel.js         (NOVO)
│   ├── controllers/
│   │   ├── assinaturaController.js          (NOVO)
│   │   └── stripeWebhookController.js       (NOVO)
│   ├── services/
│   │   └── stripeService.js     (NOVO)
│   ├── routes/
│   │   ├── assinatura.js        (NOVO)
│   │   └── stripe.js            (NOVO)
│   └── jobs/
│       └── trialExpirationJob.js (NOVO)
├── app.js                        (MODIFICAR)
└── .env                          (MODIFICAR)
```

---

## 3. CÓDIGOS PRONTOS

### 3.1 `src/services/stripeService.js`

```javascript
const Stripe = require('stripe');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, {
  apiVersion: process.env.STRIPE_API_VERSION || '2024-12-18'
}) : null;

function assertStripeConfigured() {
  if (!stripe) {
    throw new Error('Stripe não configurado: defina STRIPE_SECRET_KEY');
  }
  if (typeof stripeSecret !== 'string' || !/^sk_/.test(stripeSecret)) {
    throw new Error('Stripe não configurado: use chave secreta sk_...');
  }
}

module.exports = {
  getClient() {
    assertStripeConfigured();
    return stripe;
  },

  async createCustomer({ email, name, metadata = {} }) {
    assertStripeConfigured();
    return stripe.customers.create({
      email,
      name: name || undefined,
      metadata
    });
  },

  async createSubscriptionCheckoutSession({
    customerId,
    customerEmail,
    priceAmountCentavos,
    productName,
    metadata = {},
    successUrl,
    cancelUrl
  }) {
    assertStripeConfigured();
    const params = {
      mode: 'subscription',
      payment_method_types: ['card'],
      locale: 'pt-BR',
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: productName || 'FilaLivre Subscription' },
          unit_amount: priceAmountCentavos,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata }
    };
    
    if (customerId) params.customer = customerId;
    else if (customerEmail) params.customer_email = customerEmail;
    
    return stripe.checkout.sessions.create(params);
  },

  async getCustomerPortalSession({ customerId, returnUrl }) {
    assertStripeConfigured();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }
};
```

### 3.2 `src/models/planoModel.js`

```javascript
const pool = require('../config/database');

module.exports = {
  async listar(apenasAtivos = true) {
    const connection = await pool.getConnection();
    try {
      const where = apenasAtivos ? 'WHERE ativo = TRUE' : '';
      const [rows] = await connection.execute(
        `SELECT id, nome, descricao, limite_min_usuarios, limite_max_usuarios,
                valor_mensal, tag_popular, ativo, ordem
         FROM plano_plataforma
         ${where}
         ORDER BY ordem ASC`
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async obterPorNumUsuarios(numUsuarios) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, nome, descricao, limite_min_usuarios, limite_max_usuarios, valor_mensal
         FROM plano_plataforma
         WHERE ativo = TRUE
           AND limite_min_usuarios <= ?
           AND (limite_max_usuarios IS NULL OR limite_max_usuarios >= ?)
         ORDER BY ordem ASC
         LIMIT 1`,
        [numUsuarios, numUsuarios]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async criar(dados) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO plano_plataforma (nome, descricao, limite_min_usuarios, 
          limite_max_usuarios, valor_mensal, tag_popular, ativo, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dados.nome, dados.descricao || null,
          dados.limite_min_usuarios ?? 0,
          dados.limite_max_usuarios ?? null,
          dados.valor_mensal ?? null,
          !!dados.tag_popular,
          dados.ativo !== false,
          dados.ordem ?? 0
        ]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  }
};
```

### 3.3 `src/models/assinaturaModel.js`

```javascript
const pool = require('../config/database');

const DIAS_TRIAL = 7;

function calcularCicloAssinatura(inicioDate) {
  const inicio = new Date(inicioDate);
  const hoje = new Date();
  const dInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const dHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  
  let diffDias = Math.floor((dHoje - dInicio) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) diffDias = 0;
  
  const emTrial = diffDias < DIAS_TRIAL;
  const diasRestantesTrial = emTrial ? Math.max(1, DIAS_TRIAL - diffDias) : 0;
  
  let proximaCobranca = new Date(inicio);
  proximaCobranca.setDate(proximaCobranca.getDate() + DIAS_TRIAL);
  
  return { emTrial, diasRestantesTrial, proximaCobranca };
}

module.exports = {
  calcularCicloAssinatura,

  async buscarPorOrganizacao(organizacaoId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, nome, created_at, stripe_customer_id, 
                stripe_subscription_id, assinatura_status, ativo
         FROM organizacao
         WHERE id = ? LIMIT 1`,
        [organizacaoId]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async atualizarStripeInfo(organizacaoId, dados) {
    const connection = await pool.getConnection();
    try {
      const campos = [];
      const valores = [];
      
      if (dados.stripe_customer_id !== undefined) {
        campos.push('stripe_customer_id = ?');
        valores.push(dados.stripe_customer_id);
      }
      if (dados.stripe_subscription_id !== undefined) {
        campos.push('stripe_subscription_id = ?');
        valores.push(dados.stripe_subscription_id);
      }
      if (dados.assinatura_status !== undefined) {
        campos.push('assinatura_status = ?');
        valores.push(dados.assinatura_status);
      }
      
      if (campos.length === 0) return { success: false };
      
      valores.push(organizacaoId);
      
      await connection.execute(
        `UPDATE organizacao SET ${campos.join(', ')} WHERE id = ?`,
        valores
      );
      
      return { success: true };
    } finally {
      connection.release();
    }
  }
};
```

### 3.4 `src/controllers/assinaturaController.js`

```javascript
const pool = require('../config/database');
const assinaturaModel = require('../models/assinaturaModel');
const planoModel = require('../models/planoModel');
const stripeService = require('../services/stripeService');

module.exports = {
  async minha(req, res) {
    try {
      const organizacaoId = parseInt(req.query.organizacao_id || req.organizer?.id, 10);
      if (!organizacaoId || isNaN(organizacaoId)) {
        return res.status(400).json({
          success: false,
          error: 'Organização não identificada'
        });
      }

      const organizacao = await assinaturaModel.buscarPorOrganizacao(organizacaoId);
      if (!organizacao) {
        return res.status(404).json({
          success: false,
          error: 'Organização não encontrada'
        });
      }

      const connection = await pool.getConnection();
      try {
        const [countRows] = await connection.execute(
          `SELECT COUNT(*) as total FROM usuario 
           WHERE id_organizacao = ? AND ativo = 1`,
          [organizacaoId]
        );
        const usuariosAtivos = countRows[0]?.total || 0;
      } finally {
        connection.release();
      }

      let plano = await planoModel.obterPorNumUsuarios(usuariosAtivos);
      if (!plano) {
        const planos = await planoModel.listar(true);
        plano = planos[0] || null;
      }

      const ciclo = assinaturaModel.calcularCicloAssinatura(organizacao.created_at);
      const temAssinatura = !!(organizacao.stripe_subscription_id && organizacao.assinatura_status);
      const trialExpirado = !ciclo.emTrial && !temAssinatura;

      let status = 'trial';
      let statusLabel = ciclo.emTrial
        ? `Trial ativo (${ciclo.diasRestantesTrial} dias)`
        : 'Ative seu plano para continuar';

      if (temAssinatura) {
        status = organizacao.assinatura_status;
        if (status === 'ativa') statusLabel = 'Assinatura ativa';
        else if (status === 'pendente') statusLabel = 'Pagamento pendente';
        else if (status === 'cancelada') statusLabel = 'Assinatura cancelada';
      } else if (trialExpirado) {
        status = 'trial_expirado';
        statusLabel = 'Trial expirou. Ative para continuar.';
      }

      return res.json({
        success: true,
        data: {
          plano_nome: plano?.nome || '-',
          valor: plano?.valor_mensal || null,
          status,
          status_label: statusLabel,
          usuarios_ativos: usuariosAtivos,
          proxima_cobranca: ciclo.proximaCobranca
        }
      });
    } catch (error) {
      console.error('[Assinatura] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar assinatura'
      });
    }
  },

  async ativar(req, res) {
    try {
      const organizacaoId = parseInt(req.body?.organizacao_id, 10);
      if (!organizacaoId || isNaN(organizacaoId)) {
        return res.status(400).json({
          success: false,
          error: 'Organização não identificada'
        });
      }

      const connection = await pool.getConnection();
      try {
        const organizacao = await assinaturaModel.buscarPorOrganizacao(organizacaoId);
        if (!organizacao) {
          return res.status(404).json({ success: false, error: 'Organização não encontrada' });
        }

        const [countRows] = await connection.execute(
          `SELECT COUNT(*) as total FROM usuario WHERE id_organizacao = ? AND ativo = 1`,
          [organizacaoId]
        );
        const usuariosAtivos = countRows[0]?.total || 0;

        const plano = await planoModel.obterPorNumUsuarios(usuariosAtivos);
        if (!plano || plano.valor_mensal == null) {
          return res.status(400).json({
            success: false,
            error: 'Plano não disponível ou valor sob consulta'
          });
        }

        const [ownerRows] = await connection.execute(
          `SELECT email, nome FROM usuario 
           WHERE id_organizacao = ? AND tipo = 'owner' LIMIT 1`,
          [organizacaoId]
        );
        const ownerEmail = ownerRows[0]?.email;
        const ownerNome = ownerRows[0]?.nome || organizacao.nome;

        let customerId = organizacao.stripe_customer_id;
        if (!customerId) {
          const customer = await stripeService.createCustomer({
            email: ownerEmail,
            name: ownerNome,
            metadata: { organizacao_id: String(organizacaoId) }
          });
          customerId = customer.id;
          
          await connection.execute(
            'UPDATE organizacao SET stripe_customer_id = ? WHERE id = ?',
            [customerId, organizacaoId]
          );
        }

        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const valorCentavos = Math.round(plano.valor_mensal * 100);

        const session = await stripeService.createSubscriptionCheckoutSession({
          customerId,
          customerEmail: ownerEmail,
          priceAmountCentavos: valorCentavos,
          productName: `FilaLivre - ${plano.nome}`,
          metadata: { organizacao_id: String(organizacaoId) },
          successUrl: `${baseUrl}/admin.html#assinatura?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/admin.html#assinatura`
        });

        return res.json({
          success: true,
          checkout_url: session.url
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('[Assinatura Ativar] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar checkout'
      });
    }
  },

  async portal(req, res) {
    try {
      const organizacaoId = parseInt(req.body?.organizacao_id, 10);
      if (!organizacaoId) {
        return res.status(400).json({ success: false, error: 'Organização não identificada' });
      }

      const organizacao = await assinaturaModel.buscarPorOrganizacao(organizacaoId);
      if (!organizacao?.stripe_customer_id) {
        return res.status(400).json({ success: false, error: 'Customer não configurado' });
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const session = await stripeService.getCustomerPortalSession({
        customerId: organizacao.stripe_customer_id,
        returnUrl: `${baseUrl}/admin.html#assinatura`
      });

      return res.json({
        success: true,
        portal_url: session.url
      });
    } catch (error) {
      console.error('[Portal] Erro:', error);
      return res.status(500).json({ success: false, error: 'Erro ao gerar portal' });
    }
  }
};
```

### 3.5 `src/controllers/stripeWebhookController.js`

```javascript
const pool = require('../config/database');
const stripeService = require('../services/stripeService');
const assinaturaModel = require('../models/assinaturaModel');

function getWebhookSecrets() {
  const primary = process.env.STRIPE_WEBHOOK_SECRET;
  const secondary = process.env.STRIPE_WEBHOOK_SECRET_MIN;
  return [primary, secondary].filter(Boolean);
}

module.exports = {
  async handle(req, res) {
    try {
      const stripe = stripeService.getClient();
      const sig = req.headers['stripe-signature'];
      const secrets = getWebhookSecrets();

      let event;
      let verified = false;
      let lastErr;

      for (const secret of secrets) {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, secret);
          verified = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!verified) {
        console.error('[Stripe] Assinatura inválida:', lastErr?.message);
        res.status(400).send(`Webhook Error: ${lastErr?.message}`);
        return;
      }

      console.log(`[Webhook] Evento recebido: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed': {
          if (event.data.object.mode === 'subscription') {
            await handleCheckoutCompleted(event.data.object);
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          await handleInvoicePaymentSucceeded(event.data.object);
          break;
        }
        case 'invoice.payment_failed': {
          await handleInvoicePaymentFailed(event.data.object);
          break;
        }
        case 'customer.subscription.updated': {
          await handleSubscriptionUpdated(event.data.object);
          break;
        }
        case 'customer.subscription.deleted': {
          await handleSubscriptionDeleted(event.data.object);
          break;
        }
        default:
          break;
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Stripe] Erro no webhook:', error);
      res.status(500).send('Erro interno no webhook');
    }
  }
};

async function handleCheckoutCompleted(session) {
  const organizacaoId = session.metadata?.organizacao_id;
  const subscriptionId = typeof session.subscription === 'string' 
    ? session.subscription 
    : session.subscription?.id;

  if (!organizacaoId || !subscriptionId) return;

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `UPDATE organizacao SET stripe_subscription_id = ?, assinatura_status = 'ativa' 
       WHERE id = ?`,
      [subscriptionId, parseInt(organizacaoId, 10)]
    );
    console.log(`[Webhook] Checkout concluído para org ${organizacaoId}`);
  } finally {
    connection.release();
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id FROM organizacao WHERE stripe_subscription_id = ? LIMIT 1`,
      [invoice.subscription]
    );
    
    if (rows.length > 0) {
      await connection.execute(
        `UPDATE organizacao SET assinatura_status = 'ativa' WHERE id = ?`,
        [rows[0].id]
      );
      console.log(`[Webhook] Pagamento bem-sucedido org ${rows[0].id}`);
    }
  } finally {
    connection.release();
  }
}

async function handleInvoicePaymentFailed(invoice) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id FROM organizacao WHERE stripe_subscription_id = ? LIMIT 1`,
      [invoice.subscription]
    );
    
    if (rows.length > 0) {
      await connection.execute(
        `UPDATE organizacao SET assinatura_status = 'pendente', ativo = false WHERE id = ?`,
        [rows[0].id]
      );
      console.log(`[Webhook] Pagamento falhou org ${rows[0].id}`);
    }
  } finally {
    connection.release();
  }
}

async function handleSubscriptionUpdated(subscription) {
  const organizacaoId = subscription.metadata?.organizacao_id;
  if (!organizacaoId) return;

  const statusMap = {
    active: 'ativa',
    past_due: 'pendente',
    unpaid: 'pendente',
    canceled: 'cancelada'
  };

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `UPDATE organizacao SET assinatura_status = ?, ativo = ? WHERE id = ?`,
      [
        statusMap[subscription.status] || 'pendente',
        subscription.status === 'active' ? 1 : 0,
        parseInt(organizacaoId, 10)
      ]
    );
  } finally {
    connection.release();
  }
}

async function handleSubscriptionDeleted(subscription) {
  const organizacaoId = subscription.metadata?.organizacao_id;
  if (!organizacaoId) return;

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `UPDATE organizacao SET assinatura_status = 'cancelada', ativo = false WHERE id = ?`,
      [parseInt(organizacaoId, 10)]
    );
  } finally {
    connection.release();
  }
}
```

### 3.6 Rotas (`src/routes/assinatura.js`)

```javascript
const express = require('express');
const router = express.Router();
const assinaturaController = require('../controllers/assinaturaController');

router.get('/minha', assinaturaController.minha);
router.post('/ativar', assinaturaController.ativar);
router.post('/portal', assinaturaController.portal);

module.exports = router;
```

### 3.7 App.js - Integração

```javascript
// Adicione no topo:
const assinaturaRouter = require('./src/routes/assinatura');
const stripeWebhookController = require('./src/controllers/stripeWebhookController');

// ANTES de express.json():
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Após outros routers:
app.use('/api/assinatura', assinaturaRouter);

// Webhook Stripe:
app.post('/api/stripe/webhook', stripeWebhookController.handle);
```

### 3.8 Banco de Dados - Migrations

```sql
-- Adicionar campos em organizacao (ou tabela equivalente)
ALTER TABLE organizacao
ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
ADD COLUMN stripe_subscription_id VARCHAR(255) NULL,
ADD COLUMN assinatura_status ENUM('trial', 'ativa', 'pendente', 'cancelada') DEFAULT 'trial',
ADD INDEX idx_stripe_customer (stripe_customer_id),
ADD INDEX idx_stripe_subscription (stripe_subscription_id);

-- Criar tabela de planos
CREATE TABLE plano_plataforma (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  descricao VARCHAR(255),
  limite_min_usuarios INT NOT NULL DEFAULT 0,
  limite_max_usuarios INT NULL,
  valor_mensal DECIMAL(10,2) NULL,
  tag_popular BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir planos de exemplo
INSERT INTO plano_plataforma (nome, descricao, limite_min_usuarios, limite_max_usuarios, valor_mensal, ordem) VALUES
('Starter', 'Para começa', 0, 5, 99.00, 1),
('Professional', 'Para crescimento', 6, 20, 199.00, 2),
('Enterprise', 'Customizado', 21, NULL, NULL, 3);
```

---

## 4. FLUXO PASSO-A-PASSO

### 4.1 Criar Organização com Trial

```bash
POST /organizacoes/criar
{
  "nome": "Novo Negócio",
  "email": "owner@negocio.com",
  "tipo_cobranca": "plataforma"
}
```

**Retorno:**
```json
{
  "success": true,
  "organizacao": {
    "id": 1,
    "nome": "Novo Negócio",
    "created_at": "2024-03-09T10:00:00Z",
    "assinatura_status": "trial",  // ← Setado automático
    "stripe_customer_id": null
  }
}
```

### 4.2 Verificar Status do Trial

```bash
GET /api/assinatura/minha?organizacao_id=1
```

**Retorno (Dias 1-6):**
```json
{
  "success": true,
  "data": {
    "status": "trial",
    "status_label": "Trial ativo (7 dias)",
    "usuarios_ativos": 2,
    "plano_nome": "Starter",
    "valor": 99.00,
    "proxima_cobranca": "2024-03-16T10:00:00Z"
  }
}
```

### 4.3 Ativar Assinatura (Checkout)

```bash
POST /api/assinatura/ativar
{
  "organizacao_id": 1
}
```

**Retorno:**
```json
{
  "success": true,
  "checkout_url": "https://checkout.stripe.com/pay/cs_test_abc123..."
}
```

**Frontend:**
```javascript
fetch('/api/assinatura/ativar', { 
  method: 'POST',
  body: JSON.stringify({ organizacao_id: 1 })
})
.then(r => r.json())
.then(data => {
  window.location.href = data.checkout_url; // Redireciona para Stripe
});
```

### 4.4 Webhook: Pagamento Confirmado

Stripe envia `POST /api/stripe/webhook`:

```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_abc123",
      "mode": "subscription",
      "subscription": "sub_test_xyz789",
      "metadata": { "organizacao_id": "1" }
    }
  }
}
```

**Backend atualiza:**
```sql
UPDATE organizacao 
SET stripe_subscription_id = 'sub_test_xyz789',
    assinatura_status = 'ativa'
WHERE id = 1;
```

### 4.5 Verificar Status (Após Pagamento)

```bash
GET /api/assinatura/minha?organizacao_id=1
```

**Retorno:**
```json
{
  "success": true,
  "data": {
    "status": "ativa",
    "status_label": "Assinatura ativa",
    "usuarios_ativos": 2,
    "plano_nome": "Starter",
    "valor": 99.00
  }
}
```

### 4.6 Acessar Customer Portal

```bash
POST /api/assinatura/portal
{
  "organizacao_id": 1
}
```

**Retorno:**
```json
{
  "success": true,
  "portal_url": "https://billing.stripe.com/..."
}
```

Usuário pode:
- Ver/alterar método de pagamento
- Visualizar faturas
- Cancelar assinatura

---

## 5. TESTES END-TO-END

### 5.1 Setup de Teste

```bash
# Terminal 1: Backend rodando
npm start

# Terminal 2: Stripe CLI (webhook local)
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Retorna: whsec_test_abc123...
# Copiar e adicionar em .env como STRIPE_WEBHOOK_SECRET
```

### 5.2 Testar Checkout Manual (via API)

```bash
# 1. Criar org
curl -X POST http://localhost:3000/organizacoes/criar \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Stripe",
    "email": "teste@teste.com"
  }'

# Resposta: { "organizacao": { "id": 1, ... } }

# 2. Ativar checkout
curl -X POST http://localhost:3000/api/assinatura/ativar \
  -H "Content-Type: application/json" \
  -d '{ "organizacao_id": 1 }'

# Resposta: { "checkout_url": "https://checkout.stripe.com/..." }
# → Copiar URL e abrir no navegador
```

### 5.3 Preencher Checkout

1. Abrir URL do checkout
2. Email: `teste@teste.com`
3. Cartão: `4242 4242 4242 4242` (sucesso) ou `4000 0000 0000 0002` (recusado)
4. CVC: qualquer número
5. Data: futura (ex.: 12/25)
6. Cliar "Subscribe"

### 5.4 Simular Webhook (Stripe CLI)

```bash
# Disparar evento de checkout concluído
stripe trigger checkout.session.completed

# Ou manualmente:
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

**Verificar logs:**
```bash
# Backend deve exibir
[Webhook] Evento recebido: checkout.session.completed
[Webhook] Checkout concluído para org 1
```

### 5.5 Verificar Banco de Dados

```sql
SELECT id, nome, assinatura_status, stripe_customer_id, stripe_subscription_id
FROM organizacao
WHERE id = 1;

-- Resultado:
-- id=1, nome=Teste Stripe, assinatura_status=ativa, 
-- stripe_customer_id=cus_test_123, stripe_subscription_id=sub_test_456
```

---

## 6. TROUBLESHOOTING

### Problema: Webhook não dispara

**Solução:**
```bash
# 1. Verificar Stripe CLI escutando
stripe listen --show-logs

# 2. Se não vir "GET /api/stripe/webhook", webhook não foi reenviado
# 3. Verificar dashboard Stripe → Developers → Webhooks → Recent Deliveries

# 4. Reenviar evento manualmente:
stripe trigger checkout.session.completed
```

### Problema: "Invalid signature" no webhook

**Causa:** STRIPE_WEBHOOK_SECRET errado

**Solução:**
```bash
# 1. Executar stripe listen
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copia o whsec_test_123

# 2. Adicionar em .env
STRIPE_WEBHOOK_SECRET=whsec_test_123

# 3. Reiniciar servidor
npm start

# 4. Tentar webhook novamente
stripe trigger checkout.session.completed
```

### Problema: Assinatura não ativa após pagamento

**Debug:**
```javascript
// GET /api/assinatura/minha?organizacao_id=1&debug=1
// Adicionar em controller:
if (req.query.debug === '1') {
  const sub = await stripe.subscriptions.retrieve(
    organizacao.stripe_subscription_id
  );
  json._debug = {
    stripe_status: sub.status,
    db_status: organizacao.assinatura_status,
    match: sub.status === 'active' && organizacao.assinatura_status === 'ativa'
  };
}
```

---

## 7. CONCLUSÃO

Ao seguir este guia, você terá implementado:

✅ Trial de 7 dias  
✅ Assinatura recorrente mensal  
✅ Webhooks confiáveis  
✅ Customer Portal para gerenciamento  
✅ Sincronização BD ↔ Stripe  
✅ UI responsiva com estados de assinatura

**Próximos passos recomendados:**

1. Adicionar notificações de email (trial expirado, pagamento falho)
2. Implementar sync job noturno (reconciliação)
3. Adicionar suporte a Multiple Products/Preços
4. Testar failover de cartão (boleto como fallback)

---

**Gerado em março 2026**
