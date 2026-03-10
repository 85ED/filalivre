# Casos de Uso e Troubleshooting Avançado - Stripe Subscriptions

**Documento Complementar - Guia de Corrida**

---

## ÍNDICE

1. [Casos de Uso Comuns](#1-casos-de-uso-comuns)
2. [Troubleshooting Avançado](#2-troubleshooting-avançado)
3. [Configurações Seguras para Produção](#3-configurações-seguras-para-produção)
4. [Monitoria e Alertas](#4-monitoria-e-alertas)
5. [Fluxos Alternativos](#5-fluxos-alternativos)

---

## 1. CASOS DE USO COMUNS

### 1.1 Usuário Quer Cancelar Assinatura Manualmente

**Cenário:** Owner clica "Cancelar assinatura" no Customer Portal.

**Fluxo:**
```
1. Owner em https://billing.stripe.com/ (Customer Portal)
2. Clica "Cancel plan"
3. Stripe agenda cancelamento para fim do período
4. Dispara: customer.subscription.deleted
5. Backend atualiza: assinatura_status = 'cancelada', ativo = false
6. Acesso bloqueado
7. Owner vê: "Assinatura cancelada. Ative para retomar."
```

**Código Backend para detectar:**
```javascript
// stripeWebhookController.js
case 'customer.subscription.deleted': {
  const sub = event.data?.object;
  const organizacaoId = sub?.metadata?.organizacao_id;
  
  if (organizacaoId) {
    await connection.execute(
      `UPDATE organizacao 
       SET assinatura_status = 'cancelada', ativo = false 
       WHERE id = ?`,
      [organizacaoId]
    );
    
    // Opcional: enviar email ao owner
    await emailService.notificarCancelamento({
      email: ownerEmail,
      organizacao: organizacaoNome
    });
  }
  break;
}
```

**SQL para reativar (admin):**
```sql
UPDATE organizacao 
SET assinatura_status = 'trial', ativo = true 
WHERE id = 1;
```

---

### 1.2 Falha de Pagamento Automático

**Cenário:** Stripe tenta cobrar no dia 30 e o cartão é recusado.

**Fluxo:**
```
1. Dia 30: Stripe tenta cobrar
2. Cartão recusado
3. Dispara: invoice.payment_failed
4. Backend atualiza: assinatura_status = 'pendente'
5. Owner vê: "Pagamento pendente. Regularize seu cartão."
6. Owner pode atualizar cartão no Portal
7. Stripe tenta recobrança automática (normalmente 3-4 tentativas)
8. Sucesso: dispara invoice.payment_succeeded → status volta a 'ativa'
```

**Webhook Handler:**
```javascript
case 'invoice.payment_failed': {
  const invoice = event.data?.object;
  const subId = invoice.subscription;
  
  // Encontrar organização
  const [rows] = await connection.execute(
    'SELECT id, nome FROM organizacao WHERE stripe_subscription_id = ?',
    [subId]
  );
  
  if (rows.length > 0) {
    const org = rows[0];
    
    // Atualizar status
    await connection.execute(
      'UPDATE organizacao SET assinatura_status = ?, ativo = 0 WHERE id = ?',
      ['pendente', org.id]
    );
    
    // Notificar
    await pushNotification.enviar(org.id, {
      titulo: 'Falha no pagamento',
      mensagem: 'Seu cartão foi recusado. Atualize em Configurações.'
    });
  }
  break;
}
```

**SQL para forçar retentar:**
```sql
-- Stripe auto-retenta, mas se quiser forçar:
-- No Customer Portal, o usuário clica "Pay now"
-- Ou admin pode chamar via API:

-- stripe invoices create --subscription <sub_id>
```

---

### 1.3 Upgrade/Downgrade do Plano

**Cenário:** Owner está no Starter (5 usuários, R$ 99) mas tem 10 usuários.
Precisa do Growth (até 20 usuários, R$ 199).

**Fluxo (Manual Via Portal):**
```
1. Backend detecta: usuariosAtivos = 10 > Starter (máx 5)
2. Notificação: "Você precisa upgrades seu plano"
3. Owner vai ao Portal
4. Clica "Change plan"
5. Seleciona "Growth"
6. Stripe cria proração automática:
   - Stripe cobra: (199 - 99) / 30 * dias_restantes
   - Próxima fatura normal: 199/mês
```

**Fluxo (Automático Via Job):**
```javascript
// jobs/verificarUpgradePlanoJob.js (daily)
async function verificarUpgrades() {
  const [orgs] = await connection.execute(
    `SELECT o.id, o.stripe_subscription_id, 
            COUNT(u.id) as usuarios_ativos
     FROM organizacao o
     LEFT JOIN usuario u ON u.id_organizacao = o.id AND u.ativo = 1
     WHERE o.stripe_subscription_id IS NOT NULL
     GROUP BY o.id`
  );
  
  for (const org of orgs) {
    const planoAtual = await planoModel.obterPorNumUsuarios(org.usuarios_ativos);
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    
    // Se plano mudou
    if (planoAtual.valor_mensal !== sub.amount / 100) {
      // Atualizar subscription (proration automática)
      await stripe.subscriptions.update(
        org.stripe_subscription_id,
        {
          items: [{
            id: sub.items.data[0].id,
            price_data: {
              currency: 'brl',
              product_data: { name: planoAtual.nome },
              unit_amount: Math.round(planoAtual.valor_mensal * 100),
              recurring: { interval: 'month' }
            }
          }],
          proration_behavior: 'always_invoice' // Cria invoice de proração
        }
      );
      
      console.log(`[Upgrade] Org ${org.id} atualizada para ${planoAtual.nome}`);
    }
  }
}
```

---

### 1.4 Trial Expirou Sem Ativar Assinatura

**Cenário:** Owner criou conta dia 01, não ativou assinatura. Hoje é dia 08.

**Status Esperado:**
- `assinatura_status = 'trial'` (não mudou)
- `stripe_subscription_id = NULL`
- `ativo = false` (bloqueado)

**Detecção:**
```javascript
// assinaturaController.minha()
const ciclo = assinaturaModel.calcularCicloAssinatura(organizacao.created_at);
const temAssinatura = !!organizacao.stripe_subscription_id;
const trialExpirado = !ciclo.emTrial && !temAssinatura;

if (trialExpirado) {
  // Bloquear acesso
  papel = 'blocked';
}
```

**Job Noturno (notiicar):**
```javascript
// jobs/trialExpirationNotificationJob.js
async function notificarTrialExpirado() {
  const [orgs] = await connection.execute(`
    SELECT o.id, o.nome, o.created_at, u.email, u.nome as nome_responsavel
    FROM organizacao o
    INNER JOIN usuario u ON u.id_organizacao = o.id AND u.tipo = 'owner'
    WHERE o.stripe_subscription_id IS NULL
      AND DATEDIFF(CURDATE(), DATE(o.created_at)) >= 7
      AND NOT EXISTS (
        SELECT 1 FROM notificacao_trial_notificado 
        WHERE id_organizacao = o.id
      )
  `);
  
  for (const org of orgs) {
    // Email
    await emailService.notificarTrialExpirado({
      email: org.email,
      nome: org.nome_responsavel,
      organizacao: org.nome,
      linkAssinatura: 'https://fialivre.com.br/admin#assinatura'
    });
    
    // Push
    await pushService.enviar(org.id, {
      titulo: 'Trial expirou',
      mensagem: 'Ative seu plano para continuar usando'
    });
    
    // Marcar como notificado
    await connection.execute(
      'INSERT INTO notificacao_trial_notificado (id_organizacao) VALUES (?)',
      [org.id]
    );
  }
}
```

---

### 1.5 Sync: Stripe ↔ Banco Dessincronizado

**Cenário:** Webhook falhou, BD está desatualizado.

**Detecção:**
```javascript
// Endpoint de diagnóstico
app.get('/api/assinatura/diagnostico/:id', async (req, res) => {
  const orgId = parseInt(req.params.id, 10);
  const org = await assinaturaModel.buscarPorOrganizacao(orgId);
  
  if (!org.stripe_subscription_id) {
    return res.json({ sync: true, message: 'Sem subscription' });
  }
  
  try {
    const stripe = stripeService.getClient();
    const sub = await stripe.subscriptions.retrieve(
      org.stripe_subscription_id
    );
    
    const dbStatus = org.assinatura_status;
    const stripeStatus = sub.status === 'active' ? 'ativa' : 'pendente';
    
    const sync = dbStatus === stripeStatus;
    
    return res.json({
      sync,
      db: { status: dbStatus },
      stripe: { status: stripeStatus, current_period_end: sub.current_period_end },
      acao: !sync ? 'Sincronizar manualmente' : 'OK'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

**Sincronizar manualmente:**
```javascript
app.post('/api/assinatura/sincronizar/:id', authInternal, async (req, res) => {
  const orgId = parseInt(req.params.id, 10);
  const org = await assinaturaModel.buscarPorOrganizacao(orgId);
  
  if (!org.stripe_subscription_id) {
    return res.status(400).json({ error: 'Sem subscription' });
  }
  
  try {
    const stripe = stripeService.getClient();
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    
    const newStatus = sub.status === 'active' ? 'ativa' : 'pendente';
    
    await assinaturaModel.atualizarStripeInfo(orgId, {
      assinatura_status: newStatus
    });
    
    return res.json({
      success: true,
      message: `Status atualizado para: ${newStatus}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## 2. TROUBLESHOOTING AVANÇADO

### 2.1 Webhook Disparado Múltiplas Vezes

**Problema:** Event foi processado várias vezes, criando duplicatas.

**Solução: Idempotência**
```javascript
// stripeWebhookController.js
const webhookEventStore = {}; // Ou Redis em produção

async function handleCheckoutCompleted(session) {
  const eventId = session.id; // ou um hash único
  
  // Verificar se já foi processado
  if (webhookEventStore[eventId]) {
    console.log('Evento duplicado ignorado:', eventId);
    return;
  }
  
  // Processar
  const organizacaoId = session.metadata?.organizacao_id;
  const subscriptionId = session.subscription;
  
  await assinaturaModel.atualizarStripeInfo(organizacaoId, {
    stripe_subscription_id: subscriptionId,
    assinatura_status: 'ativa'
  });
  
  // Marcar como processado
  webhookEventStore[eventId] = true;
}
```

**Solução: Redis (Produção)**
```javascript
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

async function handleCheckoutCompleted(session) {
  const eventId = session.id;
  
  // TTL de 24 horas
  const existe = await client.get(`stripe:webhook:${eventId}`);
  if (existe) {
    console.log('Evento duplicado (Redis):', eventId);
    return;
  }
  
  // Processar normalmente
  // ...
  
  // Armazenar
  await client.setex(`stripe:webhook:${eventId}`, 86400, '1');
}
```

---

### 2.2 Erro: "Invalid API Key"

**Sintoma:** 401 Unauthorized ao chamar Stripe API

**Causa:** 
1. `STRIPE_SECRET_KEY` errada
2. Usando `sk_live_` em sandbox
3. Env var não carregado

**Solução:**
```javascript
// Validar no startup
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY não configurada');
}

if (!/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY)) {
  throw new Error('STRIPE_SECRET_KEY inválida: deve começar com sk_test_ ou sk_live_');
}

console.log('[Stripe] API Key válida');
```

---

### 2.3 Erro: "Invalid Webhook Signature"

**Sintoma:** 400 Bad Request no webhook

**Causa:**
1. Secret errado
2. Webhook secret expirado (Stripe regenera ID)
3. Request body modificado

**Solução:**
```javascript
// Registrar tentativas falhadas
for (const secret of secrets) {
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
    verified = true;
    console.log('[Webhook] Assinatura verificada com secret secundário');
    break;
  } catch (err) {
    console.error('[Webhook] Falha de verificação:', {
      secretUsed: secret.slice(0, 10) + '...',
      error: err.message
    });
    lastErr = err;
  }
}

if (!verified) {
  // Registrar para análise
  await webhookErrorLog.create({
    sig: sig,
    validSecrets: secrets.length,
    error: lastErr.message,
    ip: req.ip
  });
  
  return res.status(400).send('Invalid signature');
}
```

---

### 2.4 Erro: "Resource Not Found" (404)

**Sintoma:** Ao recuperar subscription: "No such subscription"

**Causa:**
1. `stripe_subscription_id` incorreto no BD
2. Subscription foi deletada na Stripe
3. Typo ao salvar

**Solução:**
```javascript
async function buscarSubscricaoSafely(subscriptionId) {
  if (!subscriptionId) return null;
  
  try {
    const stripe = stripeService.getClient();
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (err.statusCode === 404) {
      console.warn('[Stripe] Subscription não encontrada:', subscriptionId);
      
      // Limpar BD
      await connection.execute(
        'UPDATE organizacao SET stripe_subscription_id = NULL WHERE stripe_subscription_id = ?',
        [subscriptionId]
      );
      
      return null;
    }
    throw err;
  }
}
```

---

### 2.5 Erro: "Payment Method Required"

**Sintoma:** Ao criar checkout: "Your customers must have a payment method"

**Causa:** Para subscription sem customer_email, precisa de método de pagamento

**Solução:**
```javascript
// Garantir customerEmail
const session = await stripeService.createSubscriptionCheckoutSession({
  customerId: customerId || null,  // Se null, precisa email
  customerEmail: ownerEmail,        // ← OBRIGATÓRIO se sem customerId
  priceAmountCentavos: valorCentavos,
  productName: `FilaLivre - ${plano.nome}`,
  metadata: { organizacao_id },
  successUrl,
  cancelUrl
});
```

---

## 3. CONFIGURAÇÕES SEGURAS PARA PRODUÇÃO

### 3.1 Secrets em Variáveis de Ambiente

**NUNCA:**
```javascript
// ❌ ERRADO
const STRIPE_KEY = 'sk_live_abc123...'; // hardcoded
```

**SEMPRE:**
```javascript
// ✅ CORRETO
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY não configurada');
```

### 3.2 Rotação de Secrets

**No Stripe Dashboard:**
1. Developers → API Keys
2. "Reveal test/live key"
3. Gerar nova chave (old key expira em 30 dias)
4. Atualizar `.env` e redeploy

**Com Secondary Secret:**
```bash
# Primary (ativo)
STRIPE_SECRET_KEY=sk_live_abc123...

# Secondary (durante transição)
STRIPE_WEBHOOK_SECRET_MIN=whsec_live_abc123...
```

### 3.3 Webhook Endpoint Seguro

**HTTPS apenas:**
```javascript
// Stripe Dashboard → Webhooks → Endpoint URL
// https://fialivre.com.br/api/stripe/webhook ✅
// http://localhost/... ❌ (não em produção)
```

**IP Whitelist (opcional):**
```javascript
app.post('/api/stripe/webhook', (req, res, next) => {
  const stripeIPs = ['34.198.180.50', '34.206.127.211']; // Stripe IPs
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!stripeIPs.includes(clientIP)) {
    console.warn('[Webhook] IP não autorizado:', clientIP);
    // Opcional: bloquear
  }
  
  next();
});
```

### 3.4 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 60000, // 1 min
  max: 1000,       // 1000 por minuto (Stripe sends in bursts)
  keyGenerator: (req) => req.headers['stripe-signature'] || req.ip
});

app.post('/api/stripe/webhook', webhookLimiter, stripeWebhookController.handle);
```

### 3.5 Logging Seguro

```javascript
// ✅ CORRETO: Nunca logar secrets
console.log('[Stripe] Secret válida:', key.slice(0, 10) + '***');

// ❌ ERRADO
console.log('[Stripe] Secret:', STRIPE_SECRET_KEY); // Exposição

// ✅ CORRETO: Logar eventos, não dados sensíveis
console.log('[Webhook] Evento:', {
  type: event.type,
  organizacao_id: event.data.object.metadata?.organizacao_id,
  timestamp: new Date().toISOString()
});
```

---

## 4. MONITORIA E ALERTAS

### 4.1 Dashboard de Saúde Stripe

```javascript
// GET /api/stripe/health?auth=TOKEN
app.get('/api/stripe/health', authInternal, async (req, res) => {
  try {
    const stripe = stripeService.getClient();
    
    // Teste de conexão
    const customers = await stripe.customers.list({ limit: 1 });
    
    // Contar subscriptions
    const subs = await stripe.subscriptions.list({
      limit: 100,
      status: 'all'
    });
    
    const activeCount = subs.data.filter(s => s.status === 'active').length;
    const failedCount = subs.data.filter(s => s.status === 'past_due').length;
    
    return res.json({
      success: true,
      stripe: {
        connected: true,
        subscriptions_active: activeCount,
        subscriptions_failed: failedCount,
        last_check: new Date()
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Stripe desconectado',
      message: err.message
    });
  }
});
```

### 4.2 Alertas por Email

```javascript
// jobs/stripeHealthCheckJob.js (hourly)
async function verificarSaudeStripe() {
  try {
    const stripe = stripeService.getClient();
    
    // Verificar webhooks não entregues
    const webhooks = await stripe.webhookEndpoints.list();
    const endpoint = webhooks.data[0];
    
    if (!endpoint) {
      await emailService.alertarAdmin({
        assunto: '[ALERTA] Stripe: Nenhum webhook configurado',
        corpo: 'Verificar dashboard'
      });
      return;
    }
    
    // Verificar invoices vencidas
    const [invoices] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM stripe_invoice_log
      WHERE status = 'open' AND data_vencimento < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    if (invoices[0].count > 0) {
      await emailService.alertarAdmin({
        assunto: `[ALERTA] ${invoices[0].count} invoices vencidas`,
        corpo: 'Revisar invoices abertas'
      });
    }
  } catch (err) {
    console.error('[Health] Erro:', err);
  }
}

// Agendar em app.js
schedule.scheduleJob('0 * * * *', verificarSaudeStripe); // Hourly
```

### 4.3 Métricas para Dashboard

```javascript
// GET /api/stripe/metricas?auth=TOKEN
app.get('/api/stripe/metricas', authInternal, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const metrics = {};
    
    // Assinaturas ativas
    const [active] = await connection.execute(
      'SELECT COUNT(*) as count FROM organizacao WHERE assinatura_status = "ativa"'
    );
    metrics.subscriptions_active = active[0].count;
    
    // Assinaturas pendentes
    const [pending] = await connection.execute(
      'SELECT COUNT(*) as count FROM organizacao WHERE assinatura_status = "pendente"'
    );
    metrics.subscriptions_pending = pending[0].count;
    
    // Revenue mensal (MRR)
    const [mrr] = await connection.execute(`
      SELECT SUM(p.valor_mensal) as mrr
      FROM organizacao o
      JOIN plano_plataforma p ON (
        o.usuarios_ativos >= p.limite_min_usuarios
        AND (p.limite_max_usuarios IS NULL OR o.usuarios_ativos <= p.limite_max_usuarios)
      )
      WHERE o.assinatura_status = 'ativa'
    `);
    metrics.mrr = mrr[0].mrr || 0;
    
    // Churn rate (30 dias)
    const [churn] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM organizacao
      WHERE assinatura_status = 'cancelada'
        AND DATE(updated_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);
    metrics.churn_30_days = churn[0].count;
    
    connection.release();
    
    return res.json({ success: true, metrics });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## 5. FLUXOS ALTERNATIVOS

### 5.1 Integração com CRM (Auto-criação de Deal)

```javascript
// Quando subscription é criada, registrar em CRM
async function registrarDealCRM(organizacao, subscription) {
  const hubspotAPI = require('@hubspotapi/api-client').default;
  const client = new hubspotAPI({
    accessToken: process.env.HUBSPOT_TOKEN
  });
  
  try {
    const deal = await client.crm.deals.basicApi.create({
      properties: {
        dealname: `Subscription - ${organizacao.nome}`,
        dealstage: 'closedwon',
        closedate: new Date().toISOString(),
        amount: subscription.plan.amount / 100,
        pipeline: 'default'
      }
    });
    
    console.log('[CRM] Deal criado:', deal.id);
  } catch (err) {
    console.error('[CRM] Erro ao criar deal:', err);
  }
}

// Usar no webhook
case 'checkout.session.completed': {
  const org = await organizacaoModel.buscarPorId(...);
  const sub = await stripe.subscriptions.retrieve(session.subscription);
  await registrarDealCRM(org, sub);
  break;
}
```

### 5.2 Relatório Automático de Faturamento

```javascript
// GET /api/stripe/relatorio?periodo=mensal&auth=TOKEN
app.get('/api/stripe/relatorio', authInternal, async (req, res) => {
  const periodo = req.query.periodo || 'mensal'; // mensal, trimestral, anual
  
  const connection = await pool.getConnection();
  try {
    const [data] = await connection.execute(`
      SELECT 
        DATE_TRUNC(created_at, MONTH) as mes,
        COUNT(DISTINCT id) as subscriptions_criadas,
        SUM(CASE WHEN assinatura_status = 'ativa' THEN 1 ELSE 0 END) as subscriptions_ativas,
        SUM(CASE WHEN assinatura_status = 'cancelada' THEN 1 ELSE 0 END) as subscriptions_canceladas
      FROM organizacao
      GROUP BY DATE_TRUNC(created_at, MONTH)
      ORDER BY mes DESC
    `);
    
    // Gerar CSV
    const csv = "Mês,Criadas,Ativas,Canceladas\n" + 
      data.map(r => `${r.mes},${r.subscriptions_criadas},${r.subscriptions_ativas},${r.subscriptions_canceladas}`)
        .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="faturamento.csv"');
    return res.send(csv);
  } finally {
    connection.release();
  }
});
```

### 5.3 Exportar Faturamento para Contabilidade

```javascript
// GET /api/stripe/export?format=json|xml|nfe&auth=TOKEN
app.get('/api/stripe/export', authInternal, async (req, res) => {
  const format = req.query.format || 'json';
  
  try {
    const stripe = stripeService.getClient();
    
    // Buscar invoices de produção (últimos 30 dias)
    const invoices = await stripe.invoices.list({
      limit: 100,
      created: {
        gte: Math.floor(Date.now() / 1000) - (30 * 86400)
      }
    });
    
    const data = invoices.data.map(inv => ({
      id: inv.id,
      customer: inv.customer,
      amount: inv.amount_paid / 100,
      date: new Date(inv.created * 1000),
      status: inv.status
    }));
    
    if (format === 'json') {
      return res.json(data);
    } else if (format === 'xml') {
      // Gerar XML para NF-e
      const xml = gerarXMLNFe(data);
      return res.type('application/xml').send(xml);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## 6. CHECKLIST FINAL ANTES DE PRODUÇÃO

- [ ] **Secrets:**
  - [ ] `STRIPE_SECRET_KEY` (live key `sk_live_...`)
  - [ ] `STRIPE_WEBHOOK_SECRET` (live secret `whsec_live_...`)
  - [ ] Armazenado em env vars (nunca hardcoded)

- [ ] **Webhook:**
  - [ ] HTTPS endpoint configurado
  - [ ] Teste de delivery bem-sucedido
  - [ ] Tratamento de duplicatas (idempotência)

- [ ] **Banco de Dados:**
  - [ ] Tabelas migradas (campos stripe_* adicionados)
  - [ ] Índices criados
  - [ ] Backup realizado

- [ ] **Testes:**
  - [ ] Criar assinatura → sucesso
  - [ ] Renovação automática → status atualizado
  - [ ] Falha de pagamento → status = 'pendente'
  - [ ] Cancelamento → status = 'cancelada'
  - [ ] Sincronização BD ↔ Stripe

- [ ] **Monitoria:**
  - [ ] Logging habilitado (sem secrets)
  - [ ] Alertas configurados (email/Slack)
  - [ ] Dashboard de saúde acessível

- [ ] **Segurança:**
  - [ ] Rate limiting ativo
  - [ ] HTTPS obrigatório
  - [ ] Autenticação em rotas internas
  - [ ] Logs de auditoria

---

**Gerado em março 2026 | Versão 1.0**
