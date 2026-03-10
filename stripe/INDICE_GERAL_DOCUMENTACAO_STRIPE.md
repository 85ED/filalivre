# ÍNDICE GERAL - Arquitetura Stripe do Guia de Corrida

**Documentação Completa para Replicação em FilaLivre**

---

## 📚 DOCUMENTOS PRINCIPAIS

Foram criados 3 documentos técnicos para compreender completamente a arquitetura Stripe do Guia de Corrida:

### 1. **ARQUITETURA_STRIPE_COMPLETA.md** 
**Entender a Arquitetura**
- Visão geral do sistema
- Estrutura de assinatura (trial de 7 dias)
- Fluxo de pagamento (Customer → Subscription)
- Webhooks e sincronização
- Banco de dados (tabelas e relacionamentos)
- Bloqueio/liberação de acesso
- Renovação automática
- Cancelamento
- Segurança e validação

**Quando usar:** Estudar o projeto do zero, entender fluxos.

---

### 2. **GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md**
**Replicar em Novo Projeto**
- Setup inicial (dependências, env vars)
- Estrutura de pastas recomendada
- Códigos prontos para copiar-colar:
  - `stripeService.js` (wrapper Stripe)
  - `assinaturaModel.js` (queries BD)
  - `assinaturaController.js` (endpoints)
  - `stripeWebhookController.js` (handlers)
  - Rotas e integração em app.js
- Fluxo passo-a-passo com exemplos
- Testes end-to-end
- Troubleshooting básico

**Quando usar:** Implementar em FilaLivre, copiar código.

---

### 3. **CASOS_USO_TROUBLESHOOTING_STRIPE.md**
**Casos Reais e Debugging**
- 5 casos de uso comuns:
  1. Cancelamento manual
  2. Falha de pagamento
  3. Upgrade/Downgrade de plano
  4. Trial expirando
  5. Dessincronização BD ↔ Stripe
- Troubleshooting avançado (webhook duplicado, erros 400/401/404)
- Configurações seguras para produção
- Monitoria e alertas
- Fluxos alternativos (CRM, relatórios)

**Quando usar:** Debugar problemas, entender casos complexos, preparar produção.

---

## 🗂️ ESTRUTURA DE LEITURA RECOMENDADA

### **Se você é iniciante em Stripe:**
1. Leia **ARQUITETURA_STRIPE_COMPLETA.md** seções 1-4 (Trial, Fluxo, Webhooks, BD)
2. Leia **GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md** seções 3-4 (Códigos prontos, Passo-a-passo)
3. Teste com **Stripe CLI** (sandbox)

### **Se você vai implementar em FilaLivre:**
1. Setup (seção 1 do Guia Prático)
2. Copiar códigos (seção 3 do Guia Prático)
3. Fazer banco de dados (seção 3.8 do Guia Prático)
4. Testes (seção 5 do Guia Prático)
5. Preparar produção (seção 3 de Troubleshooting)

### **Se você vai debugar um problema:**
1. Procure o erro em **CASOS_USO_TROUBLESHOOTING_STRIPE.md** seção 2
2. Implemente a solução
3. Teste com Stripe CLI
4. Verifique monitoria (seção 4 de Troubleshooting)

---

## 📖 SUMÁRIO EXECUTIVO

### **Fluxo Resumido:**

```
CRIAÇÃO (Dia 1)
  ↓
TRIAL (7 dias, gratuito)
  ↓
ATIVAR PLANO (Checkout Stripe)
  ├→ Criar Customer
  ├→ Criar Subscription
  └→ Cartão é cobrado
  ↓
WEBHOOK: checkout.session.completed
  ↓
ATIVA (Renovação automática a cada 30 dias)
  ├→ invoice.payment_succeeded (renovação)
  └→ invoice.payment_failed (falha)
  ↓
CANCELAMENTO
  ├→ Manual (Customer Portal)
  └→ Webhook: subscription.deleted
  ↓
BLOQUEADO ou REATIVAR
```

### **Pontos-Chave de Implementação:**

| Aspecto | O que fazer | Por quê |
|---------|-----------|--------|
| **Trial** | 7 dias automáticos a partir de `created_at` | Engajamento sem compromisso |
| **Webhook** | Validar HMAC + processar 5 eventos-chave | Sincronização confiável |
| **Idempotência** | Verificar duplicatas de eventos | Evitar cobranças duplicadas |
| **Segurança** | Secret em env vars, HTTPS, rate limit | Proteção contra vazamentos |
| **Monitoria** | Log, alertas, dashboard health | Detectar problemas antes do cliente |

---

## 🔗 REFERÊNCIAS RÁPIDAS

### **Tabelas do Banco**

| Tabela | Campos Principais | Função |
|--------|------------------|--------|
| `organizacao` | `stripe_customer_id`, `stripe_subscription_id`, `assinatura_status` | Relaciona org ↔ Stripe |
| `plano_plataforma` | `nome`, `limite_min_usuarios`, `valor_mensal` | Define planos |

### **Endpoints principais**

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/assinatura/minha` | GET | Status da assinatura |
| `/api/assinatura/ativar` | POST | Criar checkout |
| `/api/assinatura/portal` | POST | Acesso ao Customer Portal |
| `/api/stripe/webhook` | POST | Receber eventos Stripe |

### **Eventos Stripe tratados**

| Evento | Trigger | Ação no BD |
|--------|---------|-----------|
| `checkout.session.completed` | Após pagamento bem-sucedido | Salva `subscription_id`, status = `ativa` |
| `invoice.payment_succeeded` | Renovação bem-sucedida (dia 30+) | Mantém status = `ativa` |
| `invoice.payment_failed` | Falha de cobrança | Status = `pendente`, `ativo = false` |
| `subscription.updated` | Mudança na subscription | Atualiza status conforme Stripe |
| `subscription.deleted` | Cancelamento | Status = `cancelada`, `ativo = false` |

---

## 🚀 CHECKLIST RÁPIDO: IMPLEMENTAR EM NOVO PROJETO

```
FASE 1: Preparação (2 horas)
  ☐ Ler ARQUITETURA_STRIPE_COMPLETA.md (seções 1-4)
  ☐ Criar conta Stripe (sandbox e live)
  ☐ Gerar API keys (test e live)
  ☐ Configurar .env

FASE 2: Código (4-6 horas)
  ☐ Criar src/services/stripeService.js (copiar de Guia Prático)
  ☐ Criar src/models/assinaturaModel.js
  ☐ Criar src/controllers/assinaturaController.js
  ☐ Criar src/controllers/stripeWebhookController.js
  ☐ Criar rotas src/routes/assinatura.js
  ☐ Integrar em app.js (middleware + rotas)

FASE 3: Banco de Dados (30min)
  ☐ Executar migrations (adicionar campos em organizacao)
  ☐ Criar tabela plano_plataforma
  ☐ Inserir planos de exemplo

FASE 4: Testes (2-3 horas)
  ☐ Instalar Stripe CLI
  ☐ Testar checkout em sandbox
  ☐ Simular webhook (stripe trigger)
  ☐ Verificar BD foi atualizado
  ☐ Testar cancelamento e reativação

FASE 5: Produção (1 hora)
  ☐ Ler CASOS_USO_TROUBLESHOOTING.md seção 3 (Segurança)
  ☐ Configurar secrets live (sk_live_, whsec_live_)
  ☐ Registrar webhook endpoint no Dashboard
  ☐ Testar com live keys (com dummy org)
  ☐ Habilitar alertas e monitoria

Total estimado: 10-15 horas (com testes completos)
```

---

## 🎯 MAPAS MENTAIS

### **Onde cada conceito é explicado:**

**Trial (7 dias)**
- Explicação: ARQUITETURA_STRIPE_COMPLETA.md § 1
- Implementação: GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md § 3.3
- Debugging: CASOS_USO_TROUBLESHOOTING_STRIPE.md § 1.4

**Webhooks**
- Conceito: ARQUITETURA_STRIPE_COMPLETA.md § 3
- Toda lista de eventos: ARQUITETURA_STRIPE_COMPLETA.md § 3.2
- Handler completo: GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md § 3.5
- Troubleshooting: CASOS_USO_TROUBLESHOOTING_STRIPE.md § 2.1-2.5

**Segurança**
- Visão geral: ARQUITETURA_STRIPE_COMPLETA.md § 10
- Implementação: GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md § 3.5
- Produção: CASOS_USO_TROUBLESHOOTING_STRIPE.md § 3

**Renovação Automática**
- Como funciona: ARQUITETURA_STRIPE_COMPLETA.md § 6
- Fluxo completo: ARQUITETURA_STRIPE_COMPLETA.md § 9

---

## 📋 TABELA COMPARATIVA: Guia de Corrida vs seu Projeto

| Componente | Guia de Corrida | FilaLivre |
|-----------|-----------------|-----------|
| Entidade cobrada | `assessoria` | `organizacao` / `empresa` |
| Limite dinâmico | Número de atletas | Número de usuários |
| Planos | 3+ (Starter, Growth, Enterprise) | TBD |
| Trial duration | 7 dias | 7 dias (recomendado) |
| Renovação | 30 dias automáticos | 30 dias automáticos (recomendado) |
| Webhook events | 5 principais | 5 principais (iguais) |

---

## 📞 SUPORTE

### **Perguntas Frequentes:**

**P: Por onde começo?**  
R: Leia ARQUITETURA_STRIPE_COMPLETA.md seções 1-4, depois GUIA_PRATICO.md.

**P: Preciso de frontend pronto?**  
R: Não. Os documentos cobrem backend. Frontend pode usar `session.url` (Stripe hosted) ou integrar `@stripe/react-stripe-js`.

**P: E se eu quiser um plano com múltiplas cotas?**  
R: Veja CASOS_USO_TROUBLESHOOTING.md § 5.1 (Upgrade/Downgrade).

**P: Como evitar pagamentos duplicados?**  
R: CASOS_USO_TROUBLESHOOTING.md § 2.1 (Idempotência).

**P: Qual é o maior risco?**  
R: Dessincronização BD ↔ Stripe. Solve: CASOS_USO_TROUBLESHOOTING.md § 2.5 + job de sync nightly.

---

## 🔍 ÍNDICE DETALHADO

### **ARQUITETURA_STRIPE_COMPLETA.md**

| Seção | Tema | Relevância |
|-------|------|-----------|
| 1 | Estrutura de assinatura (Trial) | ⭐⭐⭐ Essencial |
| 2 | Fluxo de pagamento (Customer + Checkout) | ⭐⭐⭐ Essencial |
| 3 | Webhooks (5 eventos) | ⭐⭐⭐ Essencial |
| 4 | Banco de dados (tabelas + campos) | ⭐⭐⭐ Essencial |
| 5 | Bloqueio/liberação acesso | ⭐⭐ Importante |
| 6 | Renovação automática | ⭐⭐ Importante |
| 7 | Cancelamento | ⭐⭐ Importante |
| 8 | Estrutura Stripe (products, prices) | ⭐ Contextual |
| 9 | Fluxo completo usuário (dia-a-dia) | ⭐⭐ Importante |
| 10 | Segurança (HMAC, endpoints) | ⭐⭐⭐ Essencial |
| 11 | Stripe Connect (contas conectadas) | ⭐ Avançado |
| 12 | Env vars necessárias | ⭐⭐ Importante |
| 13 | Testes sandbox | ⭐⭐ Importante |
| 14 | Troubleshooting comum | ⭐⭐ Importante |
| 15 | Checklist implementação | ⭐⭐⭐ Essencial |

### **GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md**

| Seção | Tema | Relevância |
|-------|------|-----------|
| 1 | Setup inicial (npm, .env) | ⭐⭐⭐ Essencial |
| 2 | Estrutura de pastas | ⭐⭐ Importante |
| 3 | Códigos prontos (copy-paste) | ⭐⭐⭐ Essencial |
| 4 | Fluxo passo-a-passo | ⭐⭐⭐ Essencial |
| 5 | Testes end-to-end (com Stripe CLI) | ⭐⭐ Importante |
| 6 | Troubleshooting básico | ⭐ Contextual |

### **CASOS_USO_TROUBLESHOOTING_STRIPE.md**

| Seção | Tema | Relevância |
|-------|------|-----------|
| 1 | Casos de uso (5 cenários) | ⭐⭐ Importante |
| 2 | Troubleshooting avançado (6 erros) | ⭐⭐ Importante |
| 3 | Segurança produção | ⭐⭐⭐ Essencial |
| 4 | Monitoria e alertas | ⭐⭐ Importante |
| 5 | Fluxos alternativos (CRM, NFe) | ⭐ Avançado |

---

## 📊 ESTATÍSTICAS DOS DOCUMENTOS

| Documento | Linhas | Seções | Tópicos | Código |
|-----------|--------|--------|--------|--------|
| ARQUITETURA_STRIPE_COMPLETA.md | ~800 | 16 | 50+ | 30+ snippets |
| GUIA_PRATICO_IMPLEMENTACAO_STRIPE.md | ~900 | 7 | 40+ | 50+ snippets prontos |
| CASOS_USO_TROUBLESHOOTING_STRIPE.md | ~700 | 6 | 30+ | 25+ examples |
| **Total** | **~2.400** | **29** | **120+** | **105+ snippets** |

---

## 📌 PRÓXIMOS PASSOS

### **Para o time FilaLivre:**

1. **Semana 1:** Estude + escolha banco de dados schema
2. **Semana 2:** Implemente código backend (use GUIA_PRATICO.md)
3. **Semana 3:** Testes sandbox completos
4. **Semana 4:** Deploy em produção (leia seção 3 de TROUBLESHOOTING.md)
5. **Semana 5+:** Monitoria e iteração

### **Documentos adicionais recomendados:**
- [ ] Stripe API documentation (stripe.com/docs)
- [ ] Stripe CLI guide (github.com/stripe/stripe-cli)
- [ ] Security best practices (stripe.com/docs/security)

---

## ✅ VALIDAÇÃO: Você está pronto quando...

- [ ] Você pode explicar o fluxo Trial → Ativa → Cancelada sem consultar documentos
- [ ] Você consegue identificar qual webhook processa cada cenário
- [ ] Você consegue implementar `stripeWebhookController.js` do zero
- [ ] Você consegue debugar uma dessincronização BD ↔ Stripe
- [ ] Você consegue fazer deploy seguro em produção
- [ ] Você tem monitoramento ativo detectando problemas

---

**Documentação criada em março 2026**  
**Versão: 1.0 (Completa)**  
**Status: Pronta para replicação**

Boa sorte com FilaLivre! 🚀
