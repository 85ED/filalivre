# Arquitetura Completa de Assinaturas e Pagamentos com Stripe

**Guia de Corrida - Documento Técnico**

Data: março 2026  
Propósito: Replicação em outro projeto (FilaLivre)

---

## RESUMO EXECUTIVO

O **Guia de Corrida** implementa um sistema de assinaturas em dois modelos:

1. **Assinatura da Plataforma (Assessorias)** – Cobrança recorrente mensal via Stripe Subscriptions
2. **Cobrança de Atletas (Stripe Connect)** – Cobrança individual via Direct Charges em Connected Accounts

Este documento detalha ambos.

---

## 1. ESTRUTURA DE ASSINATURA (ASSESSORIAS)

### 1.1 Como Funciona o Trial

**Duração:** 7 dias corridos  
**Início:** Quando a assessoria é criada (`assessoria.created_at`)  
**Cálculo:** Diferença exata entre hoje e `created_at` em dias

```javascript
// src/controllers/assinaturaAssessoriaController.js
function calcularCiclo(inicioDate) {
  const inicio = new Date(inicioDate);
  const hoje = new Date();
  
  // Zera as horas para comparação exata em dias
  const dInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const dHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  
  // Diferença em dias
  let diffDias = Math.floor((dHoje - dInicio) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) diffDias = 0;
  
  // Determina se ainda está em trial
  const emTrial = diffDias < DIAS_TRIAL; // 7 dias
  let diasRestantesTrial = emTrial ? Math.max(1, DIAS_TRIAL - diffDias) : 0;
  
  return { emTrial, diasRestantesTrial };
}
```

### 1.2 Estados do Trial

| Dia | Estado | Ação Permitida | Observação |
|-----|--------|----------------|-----------|
| 0-6 | Em trial | Botão ATIVAR habilitado (opcional) | Acesso completo, sem cobro |
| 7 | Final trial | Botão "Ativar plano" obrigatório | Sem assinatura Stripe = bloqueado dia 8 |
| 8+ | Trial expirado | Botão "Ativar plano" obrigatório | Bloqueado da plataforma |

### 1.3 Detecção de Fim do Trial

**No Backend:**
```javascript
const temAssinaturaStripe = !!(assessoria.stripe_subscription_id && assessoria.assinatura_status);
const trialExpirado = !ciclo.emTrial && !temAssinaturaStripe;
```

**No Job Diário (`trialAssessoriaJob.js`):**
```sql
SELECT a.id, a.nome
FROM assessoria a
WHERE a.slug != 'runix-run-coach'
  AND a.stripe_subscription_id IS NULL
  AND DATEDIFF(CURDATE(), DATE(a.created_at)) >= 7;
```

**Notificação:** Email + Push ao owner quando expira.

---

## 2. FLUXO DE PAGAMENTO (STRIPE SUBSCRIPTIONS)

### 2.1 Criação do Customer Stripe

**Quando:** Na primeira ativação da assinatura (endpoint `POST /api/assinatura-assessoria/ativar`)

**Código:**
```javascript
const customer = await stripeService.createCustomer({
  email: ownerEmail,
  name: ownerNome,
  metadata: { assessoria_id: String(assessoriaId) }
});
customerId = customer.id;

// Armazenar no banco
await connection.execute(
  'UPDATE assessoria SET stripe_customer_id = ? WHERE id = ?',
  [customerId, assessoriaId]
);
```

**Resultado:** `Customer` criado na Stripe com email e metadata para rastreamento.

### 2.2 Criação do Checkout (Subscription)

**Tipo:** Stripe Checkout Session em modo `subscription`

```javascript
const session = await stripeService.createSubscriptionCheckoutSession({
  customerId,
  customerEmail: ownerEmail,
  priceAmountCentavos: Math.round(plano.valor_mensal * 100),
  productName: `Guia de Corrida - ${plano.nome}`,
  metadata: { assessoria_id: String(assessoriaId) },
  successUrl: `${baseUrl}/treinador.html#minha-assinatura?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${baseUrl}/treinador.html#minha-assinatura`
});
```

**Resposta:** JSON com `session.url` → Redirecionar para Checkout

### 2.3 Fluxo do Usuário

```
1. Assessoria clica "Ativar plano"
   ↓
2. Backend cria Customer (se não existir)
   ↓
3. Backend cria Checkout Session
   ↓
4. Usuário é redirecionado para session.url (hosted Stripe)
   ↓
5. Usuário preenche dados de cartão
   ↓
6. Stripe processa pagamento
   ↓
7. Webhook `checkout.session.completed` dispara
   ↓
8. Backend atualiza:
   - `assessoria.stripe_subscription_id = subscription.id`
   - `assessoria.assinatura_status = 'ativa'`
   ↓
9. Usuário redirecionado para success_url
```

### 2.4 Relação: Customer ↔ Assessoria ↔ Subscription

```
Assessoria (id=123)
├── stripe_customer_id: "cus_ABC123"
├── stripe_subscription_id: "sub_XYZ789"
└── assinatura_status: "ativa"

Stripe Customer (cus_ABC123)
├── email: owner@assessoria.com.br
├── name: "Assessoria XYZ"
└── metadata: { assessoria_id: "123" }

Stripe Subscription (sub_XYZ789)
├── customer: cus_ABC123
├── price: price_ABC123 (mensal)
├── amount: 19900 (centavos = R$ 199,00)
├── interval: monthly
└── metadata: { assessoria_id: "123" }
```

---

## 3. WEBHOOKS STRIPE

### 3.1 Webhook Handler

**Endpoint:** `POST /api/stripe/webhook`

**Middleware de Verificação:**
```javascript
const stripe = stripeService.getClient();
const sig = req.headers['stripe-signature'];
const secrets = getWebhookSecrets(); // [PRIMARY, SECONDARY]

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
  res.status(400).send(`Webhook Error: ${lastErr?.message}`);
  return;
}
```

### 3.2 Eventos Procesados

#### **1. `payment_intent.succeeded` / `invoice.payment_succeeded`**

**Quando dispara:** Pagamento de uma mensalidade aprovado

**Ações:**
1. Identifica `assessoria_id` do metadata
2. Atualiza `assessoria.assinatura_status = 'ativa'`
3. Marca `assessoria.ativo = true`

```javascript
case 'invoice.payment_succeeded': {
  const metadata = event.data?.object?.metadata || {};
  if (metadata.assessoria_id && !event.account) {
    await processarAssinaturaPlataforma(event.type, event.data.object, 'ativa');
  }
  break;
}
```

#### **2. `invoice.payment_failed`**

**Quando dispara:** Falha no pagamento da mensalidade

**Ações:**
1. Atualiza `assessoria.assinatura_status = 'pendente'`
2. Marca `assessoria.ativo = false` (bloqueio)
3. Email de notificação ao owner

```javascript
case 'invoice.payment_failed': {
  const metadata = event.data?.object?.metadata || {};
  if (metadata.assessoria_id && !connectedAccountId) {
    await processarAssinaturaPlataforma(event.type, obj, 'pendente');
  }
  break;
}
```

#### **3. `customer.subscription.updated`**

**Quando dispara:** Mudanças na subscription (ex.: cancelamento agendado)

**Ações:**
1. Map `subscription.status` → `assinatura_status`
2. Atualiza banco de dados

```javascript
case 'customer.subscription.updated': {
  const sub = event.data?.object;
  if (sub?.metadata?.assessoria_id && !event.account) {
    const status = mapStripeSubscriptionStatusToAssinatura(sub.status, event.type);
    await atualizarAssinaturaAssessoria(sub, status);
  }
  break;
}
```

**Mapeamento:**
```javascript
function mapStripeSubscriptionStatusToAssinatura(stripeStatus, eventType) {
  if (eventType === 'customer.subscription.deleted') return 'cancelada';
  const map = {
    active: 'ativa',
    past_due: 'pendente',
    unpaid: 'pendente',
    canceled: 'cancelada',
    canceled_with_period_end: 'cancelada'
  };
  return map[stripeStatus] || 'pendente';
}
```

#### **4. `customer.subscription.deleted`**

**Quando dispara:** Subscription cancelada

**Ações:**
1. Atualiza `assessoria.assinatura_status = 'cancelada'`
2. Marks `assessoria.ativo = false`

---

## 4. BANCO DE DADOS

### 4.1 Tabela `assessoria`

```sql
CREATE TABLE assessoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(80) UNIQUE NOT NULL,
  tipo_cobranca ENUM('plataforma', 'propria') DEFAULT 'propria',
  
  -- Campos Stripe Subscriptions (Cobrança Plataforma)
  stripe_customer_id VARCHAR(255) NULL 
    COMMENT 'Customer Stripe para assinatura recorrente',
  stripe_subscription_id VARCHAR(255) NULL 
    COMMENT 'Subscription ID ativa',
  assinatura_status ENUM('trial', 'ativa', 'pendente', 'cancelada') DEFAULT 'trial' 
    COMMENT 'Status assinatura plataforma',
  
  -- Campos Stripe Connect (Conta Conectada para cobranças de atletas)
  stripe_account_id VARCHAR(255) NULL 
    COMMENT 'Connected Account ID',
  onboarding_completo BOOLEAN DEFAULT FALSE 
    COMMENT 'True se onboarding da conta foi concluído',
  stripe_charges_enabled BOOLEAN DEFAULT FALSE 
    COMMENT 'True se capaz de receber pagamentos',
  stripe_onboarding_link TEXT NULL 
    COMMENT 'Account Link URL (válido por 24h)',
  stripe_onboarding_expira_em DATETIME NULL 
    COMMENT 'Expiração do Account Link',
  
  ativo BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_assessoria_stripe_customer (stripe_customer_id),
  INDEX idx_assessoria_stripe_subscription (stripe_subscription_id)
);
```

### 4.2 Tabela `plano_plataforma`

Define os planos (Starter, Growth, Enterprise) utilizados para:
- Site público (landing page)
- Minha Assinatura (seletor de plano)
- Cálculo automático de preço pelo número de atletas

```sql
CREATE TABLE plano_plataforma (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  descricao VARCHAR(255),
  limite_min_atletas INT NOT NULL DEFAULT 0,
  limite_max_atletas INT NULL COMMENT 'NULL = ilimitado (Enterprise+)',
  valor_mensal DECIMAL(10,2) NULL COMMENT 'NULL = sob consulta',
  tag_popular BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Exemplo (Starter, Growth, Enterprise):**
| id | nome | min | max | valor |
|----|----|-----|-----|-------|
| 1 | Starter | 0 | 5 | 99,00 |
| 2 | Growth | 6 | 15 | 199,00 |
| 3 | Enterprise | 16 | NULL | NULL |

### 4.3 Tabela `assessoria_trial_expirado_notificado`

Controla se já foi enviada notificação do trial expirando (evita duplicatas).

```sql
CREATE TABLE assessoria_trial_expirado_notificado (
  id_assessoria INT PRIMARY KEY,
  notificado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4 Tabela `pagamento` (Cobranças de Atletas)

Armazena cobranças manuais de atletas (modelo Stripe Connect).

```sql
CREATE TABLE pagamento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_atleta INT NOT NULL,
  id_plano INT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE NULL,
  status ENUM('pendente', 'pago', 'atrasado', 'cancelado') DEFAULT 'pendente',
  metodo_pagamento ENUM('PIX', 'Boleto', 'Cartão', 'Dinheiro') NULL,
  link_pix TEXT,
  link_boleto TEXT,
  link_cartao TEXT NULL COMMENT 'Link Checkout Stripe',
  id_emitido_por INT NULL,
  observacoes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (id_atleta) REFERENCES atleta(id) ON DELETE CASCADE,
  FOREIGN KEY (id_emitido_por) REFERENCES usuario(id) ON DELETE SET NULL
);
```

---

## 5. BLOQUEIO DO SISTEMA

### 5.1 Detecção de Expiração

**Na rota de autenticação (`usuarioModel.autenticar`):**
```javascript
const usuario = { id, email, tipo, papel, assessoriaStatus };
if (assessoriaStatus === 'pendente' || assessoriaStatus === 'cancelada') {
  papel = 'blocked';
  acesso = false;
}
```

### 5.2 Bloqueio no Frontend

Quando `papel = 'blocked'`:
1. Tela de login permite acesso
2. Dashboard redireciona para "Minha Assinatura"
3. Menu exibe apenas atalho para renovar assinatura

### 5.3 Liberação Após Pagamento

**Via webhook `invoice.payment_succeeded`:**
```javascript
await processarAssinaturaPlataforma(event.type, event.data.object, 'ativa');
// → UPDATE assessoria SET assinatura_status = 'ativa', ativo = true
```

---

## 6. RENOVAÇÃO AUTOMÁTICA

### 6.1 Como Detecta Pagamento Mensal

A Stripe gerencia completamente:
1. **Dia da renovação:** 30 dias após `subscription_period_start`
2. **Cobrança automática:** Cartão salvo (via Customer)
3. **Evento:** `invoice.payment_succeeded` disparado

**Fluxo:**
```
Dia 1: Usuário faz checkout
  → Stripe cria invoice imediatamente (primeira cobrança)
  
Dia 31: Stripe cria novo período
  → Invoice.paid_at != null
  → Webhook `invoice.payment_succeeded`
  
Backend processa:
  → UPDATE assinatura_status = 'ativa'
  → Acesso liberado
```

### 6.2 Atualização de Status

**Tabela de rastreamento (opcional):**
```sql
CREATE TABLE IF NOT EXISTS assinatura_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_assessoria INT NOT NULL,
  evento VARCHAR(100),
  stripe_subscription_id VARCHAR(255),
  status_anterior ENUM('trial', 'ativa', 'pendente', 'cancelada'),
  status_novo ENUM('trial', 'ativa', 'pendente', 'cancelada'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_assessoria) REFERENCES assessoria(id) ON DELETE CASCADE
);
```

---

## 7. CANCELAMENTO

### 7.1 Como Cancelar

**Opção 1: Via Customer Portal (Recomendado)**
```javascript
const session = await stripe.billingPortal.sessions.create({
  customer: assessoria.stripe_customer_id,
  return_url: `${baseUrl}/treinador.html#minha-assinatura`
});
// Redirecionar para session.url
```

Usuário pode:
- Ver faturas
- Alterar método de pagamento
- **Cancelar imediatamente**

**Opção 2: Backend (Admin)**
```javascript
await stripe.subscriptions.del(assessoria.stripe_subscription_id);
// Dispara: customer.subscription.deleted
```

### 7.2 O Que Acontece Após Cancelamento

1. **Webhook `customer.subscription.deleted` dispara**
2. Backend atualiza: `assinatura_status = 'cancelada'`, `ativo = false`
3. Usuário vê: "Assinatura cancelada. Ative novamente..."
4. Usuário pode **ativar novamente** (novo Customer + Subscription)

---

## 8. ESTRUTURA STRIPE

### 8.1 Produtos

**Como são criados:**
1. Manualmente no Stripe Dashboard
2. OU via SDK ao criar checkout (com `product_data`)

**No Guia de Corrida (Subscriptions):**
```javascript
line_items: [{
  price_data: {
    currency: 'brl',
    product_data: { name: `Guia de Corrida - ${plano.nome}` },
    unit_amount: valorCentavos,
    recurring: { interval: 'month' }
  },
  quantity: 1
}]
```

### 8.2 Preços

**Para Subscriptions:**
- Criados automaticamente no checkout (mode: 'subscription')
- Retenção em Stripe: Se usar o mesmo product_data, Stripe reusa o price

### 8.3 Customers

```
Customer {
  id: "cus_ABC123",
  email: "owner@assessoria.com.br",
  name: "Assessoria XYZ",
  metadata: { assessoria_id: "123" },
  subscriptions: [
    {
      id: "sub_XYZ789",
      status: "active",
      current_period_start: 1234567890,
      current_period_end: 1234567890 + (30*86400),
      items: [{
        price: {
          id: "price_ABC123",
          recurring: { interval: "month", interval_count: 1 }
        },
        quantity: 1
      }]
    }
  ]
}
```

### 8.4 Subscriptions

```
Subscription {
  id: "sub_XYZ789",
  customer: "cus_ABC123",
  status: "active",
  current_period_start: 1234567890,
  current_period_end: 1234567890 + (30*86400),
  cancel_at: null,
  canceled_at: null,
  default_payment_method: "pm_ABC123",
  metadata: { assessoria_id: "123" }
}
```

---

## 9. FLUXO COMPLETO DO USUÁRIO

```
┌─────────────────────────────────────────────────────────────┐
│ DIA 1: Novo Cadastro de Assessoria                          │
└─────────────────────────────────────────────────────────────┘
 1. Usuário preenche dados (nome, CNPJ, email)
 2. Sistema cria:
    - assessoria { created_at = NOW(), assinatura_status = 'trial' }
    - usuario { email, tipo = 'treinador' }
    - staff_assessoria { papel = 'owner', ativo = 1 }
 3. Email enviado: "Bem-vindo! Seu trial é válido por 7 dias"
 4. Dashboard exibe: "Trial ativo (7 dias restantes)"

┌─────────────────────────────────────────────────────────────┐
│ DIAS 2-6: Em Trial                                          │
└─────────────────────────────────────────────────────────────┘
 1. Acesso à plataforma: COMPLETO
 2. Botão "Ativar plano": disponível
 3. Backend retorna: { status: 'trial', dias_restantes: N }
 4. Job diário (noturno): Nada faz

┌─────────────────────────────────────────────────────────────┐
│ DIA 7: Final do Trial                                       │
└─────────────────────────────────────────────────────────────┘
 1. Acesso à plataforma: COMPLETO (último dia)
 2. Botão "Ativar plano": destacado em vermelho
 3. Notificação: "Seu trial vence amanhã! Ative para continuar."

┌─────────────────────────────────────────────────────────────┐
│ DIA 8+: Trial Expirado (SEM Assinatura)                    │
└─────────────────────────────────────────────────────────────┘
 1. Login permitido
 2. papel = 'blocked' (só pode ver "Minha Assinatura")
 3. Dashboard bloqueado: "Seu acesso expirou. Ative um plano."
 4. Job noturno (executado 1x):
    - Envia email: "Seu trial expirou! Ative para continuar."
    - Envia push: mesma mensagem
    - Marca como notificado (não reenviar)

┌─────────────────────────────────────────────────────────────┐
│ DIA X: Ativar Plano (POST /api/assinatura-assessoria/ativar)│
└─────────────────────────────────────────────────────────────┘
 1. Frontend: GET /api/assinatura-assessoria/minha
    → Retorna: { status: 'trial', plano_nome, valor, botão: 'Ativar' }
 
 2. Usuário clica "Ativar plano"
 
 3. Backend:
    - Validar assessoria + plano (por # de atletas)
    - Criar Customer (se não existir):
      POST /stripe/v1/customers
      → { email, name, metadata }
      → Salva customer_id em assessoria
    
    - Criar Checkout Session:
      POST /stripe/v1/checkout/sessions
      mode: 'subscription'
      → Retorna session.url
    
 4. Frontend redireciona para session.url (Stripe hosted)
 
 5. Usuário preenche cartão
 
 6. Stripe processa pagamento + cria subscription automaticamente

┌─────────────────────────────────────────────────────────────┐
│ WEBHOOK: checkout.session.completed                         │
└─────────────────────────────────────────────────────────────┘
 1. Stripe dispara POST /api/stripe/webhook
 2. Backend valida assinatura (HMAC)
 3. Extrai:
    - subscription_id (sub_ABC)
    - customer_id (cus_XYZ)
    - metadata.assessoria_id
 4. UPDATE assessoria:
    - stripe_subscription_id = 'sub_ABC'
    - assinatura_status = 'ativa'
    - ativo = true
 5. Email: "Assinatura ativa! Acesso restaurado."
 6. Push: "Bem-vindo! Sua assinatura está ativa."

┌─────────────────────────────────────────────────────────────┐
│ DAY 1-29: Assinatura Ativa                                 │
└─────────────────────────────────────────────────────────────┘
 1. Acesso COMPLETO = papel = 'owner'
 2. Dashboard: "Plano vigente. Próxima renovação: DD/MM"
 3. Botão "Gerenciar pagamento": leva a Customer Portal
 4. No Customer Portal pode:
    - Ver faturas
    - Atualizar cartão
    - Cancelar (agendado para fim do período)

┌─────────────────────────────────────────────────────────────┐
│ DAY 30: Renovação Automática                                │
└─────────────────────────────────────────────────────────────┘
 1. Stripe cria nova invoice (30 dias depois)
 2. Cobra automaticamente o cartão salvo
 3. Sucesso: 
    → Dispara `invoice.payment_succeeded`
    → Backend: assinatura_status = 'ativa' (mantém)
 
 4. Falha:
    → Dispara `invoice.payment_failed`
    → Backend: assinatura_status = 'pendente', ativo = false
    → Email: "Falha no pagamento! Atualize seu cartão."
    → Push: mesma mensagem
    → Acesso temporariamente bloqueado

┌─────────────────────────────────────────────────────────────┐
│ Cancelamento (Usuario clica "Cancelar" no Customer Portal)  │
└─────────────────────────────────────────────────────────────┘
 1. Usuário em Customer Portal → "Cancel plan"
 2. Stripe marca: subscription.canceled_at = NOW()
 3. Dispara: `customer.subscription.deleted`
 4. Backend:
    - assinatura_status = 'cancelada'
    - ativo = false
 5. Acesso bloqueado
 6. Dashboard: "Assinatura cancelada. Ative novamente para retomar."
 7. Botão "Ativar assinatura": permite reativar
 8. Se reativar: volta ao início (novo Customer + Subscription)
```

---

## 10. ARQUITETURA DE SEGURANÇA

### 10.1 Validação de Webhook

**HMAC Signature Verification:**
```javascript
const sig = req.headers['stripe-signature'];
const secrets = [
  process.env.STRIPE_WEBHOOK_SECRET,        // Primary
  process.env.STRIPE_WEBHOOK_SECRET_MIN     // Secondary (fallback)
];

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
  return res.status(400).send('Invalid signature');
}
```

**Configuração:**
- Gerar 2 secrets no Stripe Dashboard (alternância)
- Guardar como env vars (como `STRIPE_WEBHOOK_SECRET_MIN`)
- Validar contra ambos (permite migração)

### 10.2 Proteção de Endpoints

| Endpoint | Proteção | Detalhes |
|----------|----------|----------|
| `GET /api/assinatura-assessoria/minha` | Auth + assessoria_id | Path param: `?assessoria_id=X` |
| `POST /api/assinatura-assessoria/ativar` | Auth + body validation | Body: `{ assessoria_id }` |
| `POST /api/assinatura-assessoria/portal` | Auth + body validation | Acesso via `req.user.assessoriaId` |
| `POST /api/stripe/webhook` | Webhook signature | Sem auth (pública, mas validada por HMAC) |

### 10.3 Sincronização Stripe ↔ Banco

**Redundância:**
1. **Webhook como fonte de verdade:**
   - Cada evento Stripe → UPDATE banco de dados
   - Histórico: Guardar eventos em `assinatura_log` (audit trail)

2. **Job de Sincronização (opcional, nightly):**
   ```javascript
   // Buscar subscriptions via Stripe API
   const subscriptions = await stripe.subscriptions.list({ limit: 100 });
   
   // For each, sync com banco:
   for (const sub of subscriptions) {
     const assessoriaId = sub.metadata.assessoria_id;
     const statusMap = { active: 'ativa', past_due: 'pendente', canceled: 'cancelada' };
     
     await pool.execute(
       'UPDATE assessoria SET assinatura_status = ? WHERE id = ?',
       [statusMap[sub.status], assessoriaId]
     );
   }
   ```

3. **Verificação de Reconciliação:**
   ```javascript
   // GET /api/assinatura-assessoria/minha?debug=1
   // Retorna:
   {
     assinatura_status_db: "ativa",
     stripe_subscription_id: "sub_ABC",
     stripe_status_atual: "ativa", // Se sincronizar com Stripe
     sync_ok: true
   }
   ```

### 10.4 Proteção de Dados Sensíveis

**Nunca armazenar:**
- Números de cartão (Stripe gerencia)
- CVV
- Full tokens (apenas último 4 dígitos no recibo)

**Usar sempre:**
- `stripe_customer_id` (ID gerado pela Stripe)
- `stripe_subscription_id` (ID gerado pela Stripe)
- Referências por IDs (nunca copiar dados sensíveis)

---

## 11. MODELO ALTERNATIVO: STRIPE CONNECT (Direct Charges)

### 11.1 Conta Conectada

**Quando:** Assessoria quer cobrar atletas diretamente

**Setup:**
```javascript
// Criar conta expressa
const account = await stripe.accounts.create({
  country: 'BR',
  type: 'express',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
    boleto_payments: { requested: true }
  }
});

// Armazenar
await connection.execute(
  'UPDATE assessoria SET stripe_account_id = ? WHERE id = ?',
  [account.id, assessoriaId]
);
```

### 11.2 Onboarding

**Account Link:**
```javascript
const link = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: `${baseUrl}/treinador.html#minha-assessoria`,
  return_url: `${baseUrl}/treinador.html#sucesso-stripe`,
  type: 'account_onboarding'
});
```

**Webhook `account.updated`:**
```javascript
case 'account.updated': {
  const account = event.data?.object;
  if (account?.id) {
    const charged_enabled = account.charges_enabled;
    const requirements = account.requirements?.currently_due?.length || 0;
    
    await connection.execute(
      'UPDATE assessoria SET stripe_charges_enabled = ?, onboarding_completo = ? WHERE stripe_account_id = ?',
      [charged_enabled, requirements === 0, account.id]
    );
  }
  break;
}
```

### 11.3 Cobrança via Connected Account

**Criar Checkout em `stripe_account_id`:**
```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['boleto', 'card'],
  line_items: [{
    price_data: {
      currency: 'brl',
      product_data: { name: 'Mensalidade' },
      unit_amount: Math.round(valor * 100)
    },
    quantity: 1
  }],
  customer_email: atleta.usuario_email,
  success_url: `${baseUrl}/aluno.html#pagamentos?status=success&pg=${pagamentoId}`,
  cancel_url: `${baseUrl}/aluno.html#pagamentos?status=cancel`,
  metadata: {
    pagamento_id: String(pagamentoId),
    assessoria_id: String(assessoria.id)
  }
}, { stripeAccount: assessoria.stripe_account_id });
```

**Webhook para Connected Account:**
```javascript
const connectedAccountId = event.account;
if (connectedAccountId && metadata.pagamento_id) {
  // Pagamento foi para conta conectada
  await marcarPagamentoComoPago(metadata.pagamento_id);
}
```

---

## 12. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_abc123...
STRIPE_WEBHOOK_SECRET=whsec_test_abc123...
STRIPE_WEBHOOK_SECRET_MIN=whsec_test_xyz789...  # Secondary
STRIPE_API_VERSION=2024-12-18

# URLs
APP_URL=https://guiadecorrida.com.br
NODE_ENV=production

# Autenticação interna
INTERNAL_AUTH_TOKEN=gc_internal_2024
```

---

## 13. FLUXO DE TESTES (AMBIENTE SANDBOX)

### 13.1 Stripe Test Keys

```
Publishable: pk_test_...
Secret: sk_test_...
```

### 13.2 Cartões de Teste

| Cenário | Cartão | CVC | Data |
|---------|--------|-----|------|
| Sucesso | `4242 4242 4242 4242` | Qualquer | Futura |
| Recusado | `4000 0000 0000 0002` | Qualquer | Futura |
| Declinado CVC | `4000 0000 0000 0127` | Qualquer | Futura |

### 13.3 Boleto de Teste

```
4242 4242 4242 4242 (cartão)
+ Selecionar "Boleto"
→ Gera boleto fictício com data de validade
```

### 13.4 Simular Webhooks

```bash
# CLI Stripe
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

---

## 14. TROUBLESHOOTING COMUM

### Problema: Webhook não dispara

**Causas:**
1. Webhook secret incorreto
2. Endpoint webhook não registrado no Stripe Dashboard
3. Firewall bloqueando requisição de Stripe

**Solução:**
```bash
# Verificar webhook no Dashboard
Dashboard → Developers → Webhooks → (endpoint URL) → Recent Deliveries

# Ver erros (status code)
200 OK = sucesso
401 = signature inválida
500 = erro no backend
```

### Problema: Assinatura ativa mas status não atualiza

**Depurar:**
```javascript
// GET /api/assinatura-assessoria/minha?debug=1&assessoria_id=X
// Retorna: status do DB vs Stripe
```

**Sincronizar manual:**
```javascript
const sub = await stripe.subscriptions.retrieve(assessoria.stripe_subscription_id);
await conn.execute(
  'UPDATE assessoria SET assinatura_status = ? WHERE id = ?',
  [sub.status === 'active' ? 'ativa' : 'pendente', assessoriaId]
);
```

### Problema: Customer não criado

**Verificar:**
```javascript
const customers = await stripe.customers.list({ 
  email: ownerEmail,
  limit: 1
});
if (customers.data.length === 0) {
  // Criar manualmente
  const customer = await stripe.customers.create({ email: ownerEmail });
  await conn.execute(
    'UPDATE assessoria SET stripe_customer_id = ? WHERE id = ?',
    [customer.id, assessoriaId]
  );
}
```

---

## 15. CHECKLIST DE IMPLEMENTAÇÃO EM NOVO PROJETO

- [ ] **Banco de dados:**
  - [ ] Criar campos em tabela `assessoria`: `stripe_customer_id`, `stripe_subscription_id`, `assinatura_status`
  - [ ] Criar tabela `plano_plataforma`
  - [ ] Criar tabela `assessoria_trial_expirado_notificado` (ou similar)

- [ ] **Variáveis de ambiente:**
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET` (primary)
  - [ ] `STRIPE_API_VERSION`
  - [ ] `APP_URL`

- [ ] **Serviço Stripe:**
  - [ ] `stripeService.js` com métodos:
    - [ ] `getClient()`
    - [ ] `createCustomer()`
    - [ ] `createSubscriptionCheckoutSession()`
    - [ ] `createAccountLink()` (se usar Connected Account)

- [ ] **Controller:**
  - [ ] `assinaturaController.js`:
    - [ ] `minha()` – GET status
    - [ ] `ativar()` – POST checkout
    - [ ] `portal()` – POST portal link

- [ ] **Webhook Handler:**
  - [ ] `stripeWebhookController.js`:
    - [ ] Validação HMAC
    - [ ] Tratamento: `checkout.session.completed`
    - [ ] Tratamento: `invoice.payment_succeeded`
    - [ ] Tratamento: `invoice.payment_failed`
    - [ ] Tratamento: `customer.subscription.updated`
    - [ ] Tratamento: `customer.subscription.deleted`

- [ ] **Rotas:**
  - [ ] `POST /webhook` (webhook)
  - [ ] `GET /minha` (status)
  - [ ] `POST /ativar` (checkout)
  - [ ] `POST /portal` (customer portal)

- [ ] **Jobs:**
  - [ ] Trial expiration notification job (daily)
  - [ ] (Optional) Sync job (nightly reconciliation)

- [ ] **Frontend:**
  - [ ] Screen "Minha Assinatura" com estados (trial, ativa, pendente, cancelada)
  - [ ] Botões: "Ativar plano", "Gerenciar pagamento", "Regularizar"
  - [ ] Redirect para `session.url` e Customer Portal

- [ ] **Testes:**
  - [ ] Criar assinatura em sandbox
  - [ ] Testar webhook delivery (Stripe CLI)
  - [ ] Testar cancelamento manual
  - [ ] Testar renovação automática
  - [ ] Testar falha de pagamento

---

## 16. RESUMO FINAL

A arquitetura Stripe do Guia de Corrida é **robusta e escalável**, com:

✅ **Trial automático** (7 dias)  
✅ **Assinatura recorrente mensal** via Stripe Subscriptions  
✅ **Renovação automática** gerenciada pelo Stripe  
✅ **Webhooks confiáveis** com validação HMAC  
✅ **Status sincronizado** entre Stripe e banco de dados  
✅ **Customer Portal** para gerenciamento de pagamento  
✅ **Suporte a Connected Accounts** para cobranças de terceiros  
✅ **Logs e auditoria** de eventos

**Pontos de Atenção:**
⚠️ Validar sempre as secrets de webhook  
⚠️ Tratar timeouts e falhas de rede no webhook  
⚠️ Sincronizar periodicamente Stripe ↔ BD (job noturno)  
⚠️ Testar em sandbox antes de produção  

---

**Fim do Documento**  
Gerado em março 2026 | Versão 1.0
