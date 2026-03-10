# Diagrama Visual - Arquitetura Stripe Completa

**Visualização dos Fluxos e Componentes**

---

## 1. VISÃO GERAL DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Owner)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────┐
        │                   FRONTEND                  │
        │  (HTML + JavaScript + Stripe.js opcional)   │
        └─────────────────────────────────────────────┘
                    ↓        ↓        ↓
            ┌───────┴────────┴────────┴───────┐
            │                                  │
            ↓                                  ↓
    ┌───────────────┐              ┌──────────────────┐
    │  BACKEND      │              │  STRIPE API      │
    │  (Node.js)    │◄────────────→│  (Pagamentos)    │
    └───────────────┘              └──────────────────┘
            ↓                                  ↑
            │                         (webhook)│
            ↓                                  │
    ┌───────────────┐              ┌──────────────────┐
    │  BANCO DE     │              │  STRIPE WEBHOOK  │
    │  DADOS        │◄─────────────│  (Eventos)       │
    │  (MySQL)      │              └──────────────────┘
    └───────────────┘
```

---

## 2. FLUXO TRIAL → ATIVA → CANCELADA (DIAGRAMA SEQUENCIAL)

```
┌──────────────────────────────────────────────────────────────────────┐
│ DIA 1: CRIAÇÃO (POST /organizacoes/criar)                           │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Frontend envia: { nome, email }                                   │
│ 2. Backend cria: organizacao(created_at=NOW, assinatura_status=trial)│
│ 3. BD salva: stripe_customer_id=NULL                                 │
│ ✓ Estado: TRIAL (7 dias gratuitos)                                   │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│ DIAS 2-7: EM TRIAL                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ • Acesso COMPLETO                                                    │
│ • GET /api/assinatura/minha retorna: { status: 'trial', dias: 7 }   │
│ • Botão "Ativar plano" disponível                                   │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│ DIA 8: TRIAL EXPIRADO (SEM ASSINATURA)                              │
├──────────────────────────────────────────────────────────────────────┤
│ • acesso BLOQUEADO (papel = 'blocked')                               │
│ • Login permitido → Dashboard bloqueado                              │
│ • Botão em destaque: "Ativar plano para continuar"                  │
└──────────────────────────────────────────────────────────────────────┘
                        ↓                    ↑
                        │ Clica              │ Cancela
                        │ "Ativar"           │ checkout
                        ↓ POST /assinatura   │
                        │ /ativar            │
┌──────────────────────────────────────────────────────────────────────┐
│ CHECKOUT STRIPE (POST /assinatura/ativar)                           │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:                                                             │
│ 1. Valida org + plano (por # usuários)                              │
│ 2. Cria Customer Stripe (se não tem):                               │
│    stripe.customers.create({ email, name, metadata })              │
│    Salva em BD: stripe_customer_id = "cus_ABC"                      │
│ 3. Cria Checkout Session:                                           │
│    stripe.checkout.sessions.create({                                │
│      mode: 'subscription',                                          │
│      customer: "cus_ABC",                                           │
│      line_items: { recurring: 'month', amount: 9900 centavos }      │
│      success_url, cancel_url                                        │
│    })                                                               │
│ 4. Retorna: { checkout_url: "https://checkout.stripe.com/..." }    │
│                                                                    │
│ Frontend:                                                            │
│ 5. Redireciona para checkout_url (Stripe hosted)                    │
└──────────────────────────────────────────────────────────────────────┘
                                ↓ (User preenche cartão)
┌──────────────────────────────────────────────────────────────────────┐
│ STRIPE PROCESSA PAGAMENTO                                            │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Valida cartão                                                     │
│ 2. Cobra primeira cobrança (R$ 99 = 9900 centavos)                 │
│ 3. Cria Subscription: sub_XYZ789                                    │
│ 4. Dispara webhook: POST /api/stripe/webhook                       │
│    { type: 'checkout.session.completed', data: { ... } }           │
│ 5. Redireciona user para success_url                                │
└──────────────────────────────────────────────────────────────────────┘
                                ↓ (Assinado via HMAC)
┌──────────────────────────────────────────────────────────────────────┐
│ WEBHOOK: checkout.session.completed                                  │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:                                                             │
│ 1. Valida HMAC (stripe.webhooks.constructEvent)                     │
│ 2. Extrai: org_id, subscription_id = "sub_XYZ789"                  │
│ 3. UPDATE BD:                                                        │
│    stripe_subscription_id = "sub_XYZ789"                            │
│    assinatura_status = "ativa"                                      │
│    ativo = true                                                     │
│ 4. Envia email/push: "Bem-vindo! Assinatura ativa"                 │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│ ESTADO: ATIVA (DIA 1-29)                                            │
├──────────────────────────────────────────────────────────────────────┤
│ • Acesso COMPLETO (papel = 'owner')                                 │
│ • GET /api/assinatura/minha retorna:                                │
│   { status: 'ativa', proxima_cobranca: '30-dias-depois' }           │
│ • Botão: "Gerenciar pagamento" (vai ao Customer Portal)             │
│ • No portal, user pode:                                             │
│   - Ver faturas                                                     │
│   - Atualizar cartão                                                │
│   - Cancelar                                                        │
└──────────────────────────────────────────────────────────────────────┘
                        ↓ (Dia 30 automático)
┌──────────────────────────────────────────────────────────────────────┐
│ RENOVAÇÃO AUTOMÁTICA (DIA 30)                                        │
├──────────────────────────────────────────────────────────────────────┤
│ Stripe:                                                              │
│ 1. Cria nova invoice periodicamente                                 │
│ 2. Cobra cartão salvo automaticamente                               │
│                                                                    │
│ Sucesso:                                                            │
│ 3. Dispara webhook: invoice.payment_succeeded                      │
│ 4. Backend atualiza: status ainda "ativa"                          │
│                                                                    │
│ - OU - Falha:                                                       │
│ 3. Dispara webhook: invoice.payment_failed                         │
│ 4. Backend atualiza:                                                │
│    assinatura_status = "pendente"                                  │
│    ativo = false (bloqueado)                                       │
│ 5. Envia alerta: "Falha no pagamento. Atualize seu cartão."        │
│ 6. Stripe retenta automaticamente 3-4 vezes                        │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│ CANCELAMENTO (Player clica "Cancelar" no Customer Portal)           │
├──────────────────────────────────────────────────────────────────────┤
│ Stripe:                                                              │
│ 1. Agenda cancelamento para fim do período (ou imediato)            │
│ 2. Dispara webhook: customer.subscription.deleted                  │
│                                                                    │
│ Backend:                                                            │
│ 3. Recebe webhook                                                  │
│ 4. UPDATE BD:                                                      │
│    assinatura_status = "cancelada"                                 │
│    ativo = false (bloqueado)                                      │
│ 5. Envia email: "Assinatura cancelada"                            │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│ ESTADO: CANCELADA                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ • Acesso BLOQUEADO                                                   │
│ • Dashboard: "Assinatura cancelada. Clique para reativar."          │
│ • Botão "Ativar assinatura" → volta ao fluxo de Checkout           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. ESTRUTURA DE WEBHOOKS

```
┌─────────────────────────────────────────┐
│      STRIPE (Servidor da Stripe)        │
└─────────────────────────────────────────┘
              ↓ (POST)
┌─────────────────────────────────────────┐
│  /api/stripe/webhook                    │
│  (seu backend)                          │
└─────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────┐
│ 1. Validar HMAC (Signature)              │
│    stripe.webhooks.constructEvent(      │
│      body, sig, WEBHOOK_SECRET          │
│    )                                    │
└──────────────────────────────────────────┘
        ↓ ✓ Válido / ✗ Inválido
        │                       │
        ✓                       ✗ (400 Bad Request)
        │
        ↓
┌──────────────────────────────────────────┐
│ 2. Switch (event.type)                   │
└──────────────────────────────────────────┘
        ↓
        ├─→ checkout.session.completed
        │       ↓
        │   UPDATE org:
        │   - stripe_subscription_id = "sub_..."
        │   - assinatura_status = "ativa"
        │       ↓
        │   UPDATE BD ✓
        │
        ├─→ invoice.payment_succeeded
        │       ↓
        │   UPDATE org:
        │   - assinatura_status = "ativa"
        │       ↓
        │   UPDATE BD ✓
        │
        ├─→ invoice.payment_failed
        │       ↓
        │   UPDATE org:
        │   - assinatura_status = "pendente"
        │   - ativo = false
        │       ↓
        │   NOTIFY user ✓
        │
        ├─→ subscription.updated
        │       ↓
        │   MAP status: active → ativa, past_due → pendente
        │       ↓
        │   UPDATE BD ✓
        │
        └─→ subscription.deleted
                ↓
            UPDATE org:
            - assinatura_status = "cancelada"
            - ativo = false
                ↓
            UPDATE BD ✓
                
        ↓
┌──────────────────────────────────────────┐
│ 3. Responder 200 OK                      │
│    res.json({ received: true })          │
└──────────────────────────────────────────┘
```

---

## 4. SINCRONIZAÇÃO BD ↔ STRIPE

```
┌────────────────────────────────────────────────────────────┐
│                      CÓDIGO RODANDO                        │
└────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Frontend request: GET /api/assinatura/minha?org_id=1       │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend:                                                    │
│ 1. Query BD:                                               │
│    SELECT * FROM organizacao WHERE id = 1                 │
│    Result: { assinatura_status: 'ativa', stripe_sub_id }  │
│                                                            │
│ 2. Calcular Trial (se necessário):                        │
│    dias = agora - created_at                              │
│    emTrial = dias < 7                                     │
│                                                            │
│ 3. (Optional) Sincronizar com Stripe:                    │
│    const sub = await stripe.subscriptions.retrieve(id)   │
│    if (sub.status !== 'active' && status === 'ativa') {  │
│      // Dessincronizado! Atualizar BD                    │
│    }                                                       │
│                                                            │
│ 4. Return JSON:                                           │
│    { status, dias_restantes, proxima_cobranca }           │
└─────────────────────────────────────────────────────────────┘
        ↓
Frontend render UI conforme status
```

---

## 5. ESTRUTURA DE TABELAS

```
┌───────────────────────────────────┐
│        organizacao (ou empresa)   │
├───────────────────────────────────┤
│ id                 (PK)           │
│ nome               (VARCHAR)      │
│ email              (VARCHAR)      │
│ created_at         (DATETIME) ← ⭐ Usar para calcular trial
│ ativo              (BOOLEAN)      │
├───────────────────────────────────┤
│ stripe_customer_id (VARCHAR) ──────+→ "cus_ABC123"
│ stripe_subscription_id (VARCHAR)--+→ "sub_XYZ789"
│ assinatura_status  (ENUM) ────────+→ trial|ativa|pendente|cancelada
└───────────────────────────────────┘

┌───────────────────────────────────┐
│     plano_plataforma              │
├───────────────────────────────────┤
│ id                 (PK)           │
│ nome               (VARCHAR)      │
│ limite_min_usuarios(INT)          │
│ limite_max_usuarios(INT)          │
│ valor_mensal       (DECIMAL)      │
│ ativo              (BOOLEAN)      │
└───────────────────────────────────┘
         ↑
         │ (Usado para determinar plano automaticamente)
         │
    quantos usuários ativos?
    → SELECT COUNT(*) FROM usuario WHERE id_org = ? AND ativo = 1
    → SELECT plano FROM plano_plataforma WHERE min <= count <= max
```

---

## 6. FLUXO DE DADOS REQUEST-RESPONSE

```
CLIENTE (Frontend)
     ↓
     │ POST /api/assinatura/ativar { org_id: 1 }
     ↓
CONTROLLER
  ├→ Validar input
  ├→ Query BD (org + count usuarios)
  ├→ Determine plano (obter_por_num_usuarios)
  │
  ├→ Criar ou usar Customer existente
  │   stripe.customers.create() → cus_ABC
  │   UPDATE organizacao SET stripe_customer_id = 'cus_ABC'
  │
  ├→ Criar Checkout Session
  │   stripe.checkout.sessions.create({
  │     mode: 'subscription',
  │     customer: 'cus_ABC',
  │     line_items: [ price_data + recurring ]
  │   }) → session { url, id, subscription_id }
  │
  └→ Return { checkout_url: session.url }
     ↓
CLIENTE recebe: { checkout_url }
     ↓
JS: window.location.href = checkout_url
     ↓
STRIPE Hosted Checkout (https://checkout.stripe.com/...)
     ├→ User preenche cartão
     ├→ Clica "Subscribe"
     └→ Stripe processa
           ↓
STRIPE → POST /api/stripe/webhook
         { type: 'checkout.session.completed', ... }
           ↓
WEBHOOK CONTROLLER
  ├→ Validar HMAC
  ├→ Extrai metadata: org_id, sub_id
  ├→ UPDATE organizacao:
  │  - stripe_subscription_id = sub_id
  │  - assinatura_status = 'ativa'
  └→ Response 200 OK
           ↓
SUCCESS_URL redirect (frontend)
     ↓
CLIENTE vê: "Bem-vindo! Assinatura ativa"
```

---

## 7. MAPA DE DECISÃO (Determinar Estado do Usuário)

```
┌─ Usuário faz login
│
├─ Consultar BD:
│  SELECT assinatura_status, ativo FROM organizacao WHERE id = ?
│
├─ Se assinatura_status = 'trial':
│  │  ├─ Calcular dias: agora - created_at
│  │  ├─ Se dias < 7: papel = 'owner', acesso COMPLETO ✓
│  │  └─ Se dias >= 7 E sem stripe_subscription_id:
│  │     papel = 'blocked', só vê "Ativação" ✗
│  │
│  └─ Goto: Dashboard com status trial
│
├─ Se assinatura_status = 'ativa':
│  │  ├─ role = 'owner'
│  │  ├─ acesso = COMPLETO ✓
│  │  └─ Botão: "Gerenciar pagamento"
│  │
│  └─ Goto: Dashboard normal
│
├─ Se assinatura_status = 'pendente':
│  │  ├─ papel = 'blocked'
│  │  ├─ acesso = BLOQUEADO ✗
│  │  └─ Mensagem: "Pagamento falhou. Regularize seu cartão."
│  │
│  └─ Goto: Tela de bloqueio + "Gerenciar pagamento"
│
└─ Se assinatura_status = 'cancelada':
   │  ├─ papel = 'blocked'
   │  ├─ acesso = BLOQUEADO ✗
   │  └─ Botão: "Ativar assinatura"
   │
   └─ Goto: Tela de bloqueio + "Ativar"
```

---

## 8. JOB: Verificar Trial Expirado (Daily)

```
Midnight (00:00):
     ↓
┌─────────────────────────────────┐
│ trialExpirationNotificationJob  │
└─────────────────────────────────┘
     ↓
Query BD:
  SELECT org.* FROM organizacao org
  WHERE stripe_subscription_id IS NULL
    AND DATEDIFF(CURDATE(), DATE(created_at)) >= 7
    AND org_id NOT IN (SELECT id_org FROM notificacao_enviada)
     ↓
For each:
  ├→ Enviar EMAIL
  │  "Seu trial expirou! Ative seu plano para continuar"
  │
  ├→ Enviar PUSH
  │  "Trial expirou - Ative plano"
  │
  └→ INSERT notificacao_enviada (org_id, sent_at)
       (evitar reenvio)
     ↓
Done
```

---

## 9. ESTADOS E TRANSIÇÕES (State Machine)

```
                    ┌────────────────┐
                    │  TRIAL (7 dias)│◄──────────┐
                    └────────────────┘           │
                           ↓                     │ Reativar
                    Clica "Ativar"               │
                           ↓                     │
                    ┌────────────────┐           │
                    │  CHECKOUT      │           │
                    │  (Stripe)      │           │
                    └────────────────┘           │
                      ↓             ↓            │
                   Sucesso      Cancelar         │
                      ↓             ↓            │
                      │        TRIAL (volta)────┘
                      ↓
                ┌────────────────┐
                │  ATIVA         │◄────┐
                │  (renovação)   │     │ Pagamento bem-sucedido
                └────────────────┘     │ (dia 30+)
                      ↓                │
                    Falha de payment   │
                      ↓                │
                ┌────────────────┐     │
                │  PENDENTE      │─────┘ (retentativa automática)
                │  (bloqueado)   │
                └────────────────┘
                      ↓
                  Cancelada
                      ↓
                ┌────────────────┐
                │  CANCELADA     │
                │  (bloqueado)   │
                └────────────────┘
                      ↓
                  Reativar
                      ↓
                   TRIAL (novo ciclo)
```

---

## 10. COMPONENTES E DEPENDÊNCIAS

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICAÇÃO (seu projeto)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────┐         │
│  │   FRONTEND       │      │   BACKEND (Node.js)  │         │
│  │  (HTML + JS)     │◄────→│   Express Server     │         │
│  └──────────────────┘      │   *                  │         │
│                            │   - assinatura       │         │
│                            │   - cobranca         │         │
│                            │   - webhook          │         │
│                            └──────────────────────┘         │
│                                        ↓                     │
│                            ┌──────────────────────┐         │
│                            │   BANCO DE DADOS     │         │
│                            │   (MySQL/PostgreSQL) │         │
│                            │   * organizacao      │         │
│                            │   * usuario          │         │
│                            │   * plano_plataforma │         │
│                            └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
          ↕
┌─────────────────────────────────────────────────────────────┐
│                   STRIPE (External Service)                 │
├─────────────────────────────────────────────────────────────┤
│  • Customers (cus_*)                                        │
│  • Checkout Sessions                                        │
│  • Subscriptions (sub_*)                                    │
│  • Invoices                                                 │
│  • Webhooks                                                 │
└─────────────────────────────────────────────────────────────┘

NPM Packages:
┌────────────────┐
│ stripe         │ ← SDK Stripe
│ express        │ ← Framework web
│ mysql2/promise │ ← Driver MySQL
│ dotenv         │ ← Variáveis ambiente
│ cors           │ ← CORS
└────────────────┘
```

---

**Versão: 1.0 | Gerado em março 2026**
