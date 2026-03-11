# 🔍 DIAGNÓSTICO COMPLETO - FILALIVRE BACKEND

**Data:** 10 de março de 2026  
**Status:** Problema Identificado e Solução Pronta  
**Severidade:** CRÍTICA - Serviço WhatsApp não inicia em produção

---

## 📊 RESUMO EXECUTIVO

```
PROBLEMA IDENTIFICADO:
┌────────────────────────────────────────────────────────────┐
│ WhatsApp Service tenta usar PORT 3001 (herdado do .env)     │
│ em vez de PORT 3003, causando EADDRINUSE quando a API já   │
│ está rodando na porta 3001.                                │
│                                                             │
│ Resultado: API não consegue comunicação com WhatsApp       │
│ porque WhatsApp NUNCA inicia com sucesso.                  │
└────────────────────────────────────────────────────────────┘

CAUSA RAIZ:
server.whatsapp.js usa process.env.PORT (que é 3001 em .env)
ao invés de usar uma variável específica WHATSAPP_PORT.
```

---

## 🔧 ANÁLISE DETALHADA

### PASSO 1: Variáveis de Ambiente

**Arquivo: `.env`**
```
PORT=3001                    ← Define porta GLOBAL
WHATSAPP_SERVICE_URL=http://localhost:3003
WHATSAPP_PORT=3003           ← Existe mas não é usada!
NODE_ENV=development
```

**Problema:** 
- ❌ `PORT=3001` é compartilhado entre API e Services
- ✅ `WHATSAPP_PORT=3003` existe mas ninguém usa

---

### PASSO 2: Código da API (server.js)

**Linha 15:**
```javascript
const PORT = process.env.PORT || 3001;
```
✅ CORRETO: Usa PORT (defaults para 3001)

**Linha 51:**
```javascript
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
```
✅ CORRETO: Usa variável específica para WhatsApp

**Proxy (Linhas 52-65):**
```javascript
app.use('/api/whatsapp', async (req, res) => {
  try {
    const targetUrl = `${WHATSAPP_SERVICE_URL}${req.path}`;
    const response = await fetch(targetUrl, fetchOptions);
    // ... envia resposta
  } catch (err) {
    res.status(503).json({ error: 'Serviço WhatsApp indisponível' });
  }
});
```
✅ CORRETO: Faz proxy corretamente

---

### PASSO 3: Código do WhatsApp Service (server.whatsapp.js)

**Linha 14:**
```javascript
const PORT = process.env.PORT || 3003;
```
❌ **ERRADO!** Deveria usar `WHATSAPP_PORT` em vez de `PORT`

**Linha 118:**
```javascript
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Port: ${PORT}`);
  // ...
});
```
✅ Faz listen, mas usa PORT errado

**ERRO OBSERVADO:**
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

**Razão:**
1. API inicia com PORT=3001 ✅
2. WhatsApp tenta usar PORT=3001 também (herdado de .env) ❌
3. EADDRINUSE porque porta já está ocupada

---

### PASSO 4: Código do Worker (server.worker.js)

**Linhas 1-5:**
```javascript
import './env.js';
import pool from './src/config/database.js';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
const CHECK_INTERVAL = parseInt(process.env.WORKER_INTERVAL || '5000', 10);
```
✅ CORRETO: Usa `WHATSAPP_SERVICE_URL` (variável específica)

---

### PASSO 5: Como env.js Carrega

**Arquivo: `env.js`**
```javascript
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
```

✅ CORRETO: Carrega `.env` na inicialização

**Fluxo:**
1. `import './env.js'` em cada arquivo
2. `dotenv.config()` lê `.env`
3. `process.env.PORT` recebe valor 3001
4. Todos os serviços herdam o mesmo valor ❌

---

## 🎯 TESTE PRÁTICO (O que daria erro)

```bash
# Terminal 1: API
cd backend && npm run start
# Saída: Listening on port 3001 ✅

# Terminal 2: WhatsApp (FALHARIA)
cd backend && npm run start:whatsapp
# Erro: EADDRINUSE: address already in use 0.0.0.0:3001 ❌
```

---

## 📋 RESUMO DAS CONFIGURAÇÕES ATUAIS

| Componente | Arquivo | Variável | Valor Atual | Valor Esperado | Status |
|---|---|---|---|---|---|
| API | server.js | PORT | process.env.PORT | 3001 | ✅ |
| API | server.js | WHATSAPP_SERVICE_URL | process.env.WHATSAPP_SERVICE_URL | http://localhost:3003 | ✅ |
| **WhatsApp** | **server.whatsapp.js** | **PORT** | **process.env.PORT (HERDADO DO .env = 3001)** | **3003** | ❌ |
| **WhatsApp** | **server.whatsapp.js** | **Deveria usar** | **WHATSAPP_PORT** | **process.env.WHATSAPP_PORT** | ❌ |
| Worker | server.worker.js | WHATSAPP_SERVICE_URL | process.env.WHATSAPP_SERVICE_URL | http://localhost:3003 | ✅ |

---

## 🔴 RESPOSTA DIRETA: POR QUE A API NÃO CONSEGUE ACESSAR WHATSAPP

```
┌─────────────────────────────────────────────────────────────┐
│ 1. API inicia com sucesso (PORT=3001)                       │
│                                                              │
│ 2. WhatsApp tenta iniciar                                   │
│    └─ Usa process.env.PORT (herdado = 3001)                │
│    └─ Porta 3001 já está em uso pela API                   │
│    └─ Falha com EADDRINUSE                                  │
│    └─ WhatsApp NUNCA inicia                                 │
│                                                              │
│ 3. API tenta chamar WhatsApp via proxy                      │
│    └─ Envia fetch para http://localhost:3003               │
│    └─ Nada responde porque WhatsApp nunca iniciou          │
│    └─ Erro: "Serviço WhatsApp indisponível"                │
│                                                              │
│ CONCLUSÃO:                                                   │
│ API está TENTANDO chamar WhatsApp, mas WhatsApp não         │
│ responde porque NUNCA INICIOU.                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ SOLUÇÃO - IMPLEMENTAÇÃO

### Mudança 1: Atualizar server.whatsapp.js

**Problema:** Linha 14 usa `process.env.PORT`  
**Solução:** Usar `process.env.WHATSAPP_PORT` com fallback correto

**Antes:**
```javascript
const PORT = process.env.PORT || 3003;
```

**Depois:**
```javascript
const PORT = process.env.WHATSAPP_PORT || 3003;
```

**Benefício:** WhatsApp usa sua própria variável, não herda PORT da API

---

### Mudança 2: Documentar portas padrão

**`.env` atualizado:**
```env
# API Service
PORT=3001

# WhatsApp Microservice (agora será lido por server.whatsapp.js)
WHATSAPP_PORT=3003

# URLs de Comunicação Interna
WHATSAPP_SERVICE_URL=http://localhost:3003
```

---

## 🚀 SOLUÇÃO PARA RAILWAY (Production)

Quando o código estiver corrigido:

```
filalivre-api:
  Start Command: node server.js
  Variáveis:
    PORT=3001
    WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003

filalivre-worker:
  Start Command: node server.worker.js
  Variáveis:
    WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003
    WORKER_INTERVAL=10000

filalivre-whatsapp:
  Start Command: node server.whatsapp.js
  Variáveis:
    WHATSAPP_PORT=3003
```

---

## 🔬 TESTE DE VALIDAÇÃO (após correção)

```bash
# Terminal 1: WhatsApp (vai iniciar com sucesso agora)
npm run start:whatsapp
# Output:
# ╔══════════════════════════════════════════╗
# ║  FilaLivre WhatsApp Service              ║
# ║  Port: 3003                              ║
# ║  Environment: development                ║
# ╚══════════════════════════════════════════╝ ✅

# Terminal 2: API (faz proxy corretamente)
npm run start
# Output:
# ╔════════════════════════════════════════╗
# ║  FilaLivre Backend Server Started      ║
# ║  Port: 3001                            ║
# ╚════════════════════════════════════════╝ ✅

# Terminal 3: Testar comunicação
curl http://localhost:3001/api/whatsapp/status/1
# Resposta esperada:
# {
#   "session": "barbershop_1",
#   "active": false,
#   "status": "disconnected",
#   "qr": null
# } ✅
```

---

## 📝 RESUMO FINAL

| Item | Diagnóstico |
|---|---|
| **Erro em Produção** | `"Serviço WhatsApp indisponível"` |
| **Causa Raiz** | WhatsApp service nunca inicia (EADDRINUSE na porta 3001) |
| **Arquivo Problemático** | `backend/server.whatsapp.js` linha 14 |
| **Linha Errada** | `const PORT = process.env.PORT \|\| 3003;` |
| **Linha Correta** | `const PORT = process.env.WHATSAPP_PORT \|\| 3003;` |
| **Tipo de Erro** | Configuração incorreta de variáveis de ambiente |
| **Severidade** | CRÍTICA - API completamente desabilitada |
| **Dificuldade da Correção** | MÍNIMA - 1 linha de código |
| **Risco da Mudança** | NENHUM - não afeta lógica, apenas porta |
| **Número de Arquivos a Alterar** | 2 (server.whatsapp.js + .env) |

---

**Pronto para implementar a solução!**
