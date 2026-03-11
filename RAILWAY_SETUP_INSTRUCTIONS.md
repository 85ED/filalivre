# Instruções de Configuração Railway - OPÇÃO A

**Data:** 10 de março de 2026  
**Status:** A ser executado manual via Railway UI  
**Duração esperada:** ~5 minutos

---

## 📋 Resume do que vai mudar

Atualmente todos os 3 serviços usam `node server.js`.  
Vamos sobrescrever o Start Command de cada serviço via Railway UI para que cada um execute seu arquivo correto.

```
ANTES:
  filalivre-api      → node server.js ← CORRETO
  filalivre-worker   → node server.js ← ERRADO (deveria ser server.worker.js)
  filalivre-whatsapp → node server.js ← ERRADO (deveria ser server.whatsapp.js)

DEPOIS:
  filalivre-api      → node server.js ✅
  filalivre-worker   → node server.worker.js ✅
  filalivre-whatsapp → node server.whatsapp.js ✅
```

---

## 🚀 PASSO A PASSO

### SERVIÇO 1: filalivre-api

#### 1.1 - Acessar settings do serviço

```
1. Ir para: https://railway.app
2. Fazer login na sua conta
3. Abrir o projeto "filalivre" (ou seu nome do projeto)
4. Na seção "Services" (esquerda), clicar em "filalivre-api"
5. Clicar na aba "Deploy" (topo)
```

#### 1.2 - Alterar Start Command

```
Campo atual: (pode estar vazio ou "node server.js")

Novo valor:
node server.js

Salvar ✅
```

#### 1.3 - Adicionar variável de ambiente

```
Na mesma aba "Deploy", subir até "Environment Variables"

Se WHATSAPP_SERVICE_URL já existir:
  → Editar o valor para: http://filalivre-whatsapp:3003

Se não existir:
  → Clicar em "Add Variable"
  → Campo "Key": WHATSAPP_SERVICE_URL
  → Campo "Value": http://filalivre-whatsapp:3003
  → Salvar ✅
```

**Resultado esperado:**

```
Start Command: node server.js
Variables:
  DB_HOST=...
  DB_PORT=...
  DB_USER=...
  DB_PASS=...
  DB_NAME=...
  JWT_SECRET=...
  NODE_ENV=production
  CORS_ORIGIN=...
  STRIPE_SECRET_KEY=...
  WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003 ← NOVO
```

---

### SERVIÇO 2: filalivre-worker

#### 2.1 - Acessar settings do serviço

```
1. Voltar à tela do projeto
2. Na seção "Services" (esquerda), clicar em "filalivre-worker"
3. Clicar na aba "Deploy" (topo)
```

#### 2.2 - Alterar Start Command

```
Campo atual: node server.js

Novo valor:
node server.worker.js

Salvar ✅
```

#### 2.3 - Adicionar variáveis de ambiente

```
Na mesma aba "Deploy", ir em "Environment Variables"

Adicionar 2 variáveis:

VARIÁVEL 1:
  Key: WHATSAPP_SERVICE_URL
  Value: http://filalivre-whatsapp:3003
  Salvar ✅

VARIÁVEL 2:
  Key: WORKER_INTERVAL
  Value: 10000
  Salvar ✅
```

**Importantes:**

- **WHATSAPP_SERVICE_URL**: URL interna do Railway para acessar o seviço WhatsApp
- **WORKER_INTERVAL**: Intervalo em milissegundos entre ciclos de verificação de fila
  - `10000` = 10 segundos (padrão recomendado - evita excesso de queries no banco)
  - Nota: Em SaaS real, intervalos muito curtos (5s) podem gerar muitas queries. Você pode otimizar depois aumentando para 15000 ou 20000 se necessário.

**Resultado esperado:**

```
Start Command: node server.worker.js
Variables:
  DB_HOST=...
  DB_PORT=...
  DB_USER=...
  DB_PASS=...
  DB_NAME=...
  NODE_ENV=production
  WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003 ← NOVO
  WORKER_INTERVAL=10000 ← NOVO (10 segundos)
```

---

### SERVIÇO 3: filalivre-whatsapp

#### 3.1 - Acessar settings do serviço

```
1. Voltar à tela do projeto
2. Na seção "Services" (esquerda), clicar em "filalivre-whatsapp"
3. Clicar na aba "Deploy" (topo)
```

#### 3.2 - Alterar Start Command

```
Campo atual: node server.js

Novo valor:
node server.whatsapp.js

Salvar ✅
```

#### 3.3 - Verificar variáveis de ambiente

```
Na seção "Environment Variables", verificar se existem:

OBRIGATÓRIAS (devem estar presentes):
  ✅ DB_HOST
  ✅ DB_PORT
  ✅ DB_USER
  ✅ DB_PASS
  ✅ DB_NAME
  ✅ NODE_ENV

OPCIONAL (padrão: 3003):
  • WHATSAPP_PORT (não precisa adicionar, usa padrão)
```

Se faltarem as obrigatórias, adicionar manualmente (devem ser as mesmas do filalivre-api).

**Resultado esperado:**

```
Start Command: node server.whatsapp.js
Variables:
  DB_HOST=...
  DB_PORT=...
  DB_USER=...
  DB_PASS=...
  DB_NAME=...
  NODE_ENV=production
```

---

## ✅ APÓS CONFIGURAR OS 3 SERVIÇOS

### Teste de Deploy

```
1. Voltar à tela principal do projeto
2. Clicar em "Deploy" (no topo)
3. Cada serviço vai fazer redeploy com suas novas configs
4. Aguardar até que os 3 mostrem status "Success" (ícone verde)
```

### Verificação

Após o deploy bem-sucedido:

**filalivre-api (expect 200):**
```bash
curl https://filalivre-api.up.railway.app/health
```

Resultado esperado:
```json
{"status":"ok","timestamp":"2026-03-10T..."}
```

---

**filalivre-worker (sem endpoint HTTP, verificar logs):**

```
Na Railway UI → filalivre-worker → Logs

Deve aparecer algo como:
[FilaLivre Queue Worker]
WhatsApp URL: http://filalivre-whatsapp:3003
Interval: 10000ms
```

---

**filalivre-whatsapp (expect 200):**

```bash
curl https://filalivre-whatsapp.up.railway.app/health
```

Resultado esperado:
```json
{
  "service":"filalivre-whatsapp",
  "status":"ok",
  "timestamp":"2026-03-10T..."
}
```

---

## 🔍 Troubleshooting

### Se filalivre-worker não inicia

**Log esperado:**
```
[FilaLivre Queue Worker]
WhatsApp URL: http://filalivre-whatsapp:3003
Interval: 5000ms
```

**Se estiver diferente:**
1. Verificar se WHATSAPP_SERVICE_URL foi adicionado corretamente
2. Verificar se variáveis do banco (DB_*) foram copiadas do filalivre-api
3. Clicar em "Retry Deploy"

---

### Se filalivre-api não consegue chamar WhatsApp

**Erro esperado a NÃO dar:**
```
[WhatsApp Proxy] Error: fetch failed
Serviço WhatsApp indisponível
```

**Se der:**
1. Verificar se filalivre-whatsapp está em status "Success"
2. Verificar se WHATSAPP_SERVICE_URL em filalivre-api está como `http://filalivre-whatsapp:3003`
3. Verificar se o serviço responde direto em `/health`

---

### Se filalivre-whatsapp falha ao conectar

**Log esperado:**
```
[FilaLivre WhatsApp Service] Serviço WhatsApp respondendo na porta 3003
[WhatsApp] ... (logs de conexão)
```

**Se houver erro:**
1. Verificar variáveis do banco
2. Verificar se existe conexão com DB (mesmo que os outros 2 serviços)
3. Verificar logs completos na Railway UI

---

## 📝 Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| filalivre-api Start Command | node server.js | node server.js |
| filalivre-worker Start Command | node server.js | **node server.worker.js** |
| filalivre-whatsapp Start Command | node server.js | **node server.whatsapp.js** |
| filalivre-api WHATSAPP_SERVICE_URL | (não tinha) | **http://filalivre-whatsapp:3003** |
| filalivre-worker WHATSAPP_SERVICE_URL | (não tinha) | **http://filalivre-whatsapp:3003** |
| filalivre-worker WORKER_INTERVAL | (não tinha) | **10000ms (10 segundos)** |

---

## 🎯 O que não vai mudar

✅ Código fonte (nada alterado em .js, .json ou .ts)  
✅ Banco de dados (mesma conexão compartilhada)  
✅ Variáveis existentes (apenas adicionadas novas)  
✅ UI Frontend (nenhuma alteração)  
✅ Comunicação interna (via Railway Private Network)

---

## 📊 Nota sobre WORKER_INTERVAL

O padrão escolhido foi **10 segundos (10000ms)** por ser mais conservador para SaaS real:

```
Intervalo  | Queries/hora | Observação
-----------|--------------|------------------
5 segundos |     720      | ⚠️ Muito agressivo, muita carga no banco
8 segundos |     450      | ✅ Bom balanço
10 segundos|     360      | ✅ PADRÃO - Mais seguro para começar
15 segundos|     240      | ✅ Para aplicações de crescimento lento
20 segundos|     180      | ✅ Para poucos clientes
```

**Você pode otimizar depois:**
- Se quiser alertas mais rápidos: diminua para 8000ms
- Se tiver muitos clientes: aumente para 15000ms ou 20000ms
- Monitore: Railway UI → Metrics → DB connections

---

## ⏱️ Tempo estimado

- Configurar filalivre-api: **2 min**
- Configurar filalivre-worker: **2 min**
- Configurar filalivre-whatsapp: **1 min**
- Deploy e testes: **2-3 min**
- **Total: ~7-8 minutos**

---

**Documento pronto para executar na Railway UI.**  
**Sem quebra de código. Sem alterações de repositório.**  
**Apenas configurações de infraestrutura.**
