# FilaLivre - Manual Startup Commands

Sem `railway.json` automático. Inicie cada serviço manualmente conforme necessário.

---

## 3 Serviços Principais

### 1️⃣ API Principal (Porta 8080/3001)

```bash
cd backend
npm install
node server.js
```

**O que faz:**
- Sistema principal de filas
- Autenticação/Login
- Proxy para WhatsApp Service
- Banco de dados
- Stripe webhooks

---

### 2️⃣ WhatsApp Service (Porta 3003)

```bash
cd backend
npm install
node server.whatsapp.js
```

**O que faz:**
- Gerencia sessões WhatsApp (QR code, conectar, desconectar)
- Puppeteer + WPPConnect
- Requer sistema Chromium (`/usr/bin/chromium`)

---

### 3️⃣ Worker (Background Jobs)

```bash
cd backend
npm install
node server.worker.js
```

**O que faz:**
- Processa jobs em background
- Emails, notificações assincronas
- Tarefas agendadas

---

## Rodar Tudo em Local Development

```bash
# Terminal 1 - API Principal
cd backend && node server.js

# Terminal 2 - WhatsApp Service
cd backend && node server.whatsapp.js

# Terminal 3 - Worker
cd backend && node server.worker.js
```

---

## Railway (Produção)

Se quer rodar no Railway sem `railway.json` automático:

### Via Railway CLI (Uma Vez)

```bash
# Terminal 1
railway run node server.js

# Terminal 2
railway run node server.whatsapp.js

# Terminal 3
railway run node server.worker.js
```

---

## Verificar Saúde dos Serviços

```bash
# API
curl http://localhost:8080/health
# ou
curl https://filalivre-production.up.railway.app/health

# WhatsApp
curl http://localhost:3003/ping
# ou
curl https://filalivre-whatsapp.up.railway.app/ping

# Worker (se tiver endpoint)
curl http://localhost:3000/health
```

---

## Variáveis de Ambiente Necessárias

Crie `.env` no `backend/`:

```env
# Database
DATABASE_URL=mysql://user:password@host/database

# JWT
JWT_SECRET=sua_chave_secreta

# CORS (Frontend)
CORS_ORIGIN=http://localhost:5173,https://filalivre.app.br

# WhatsApp Service URL
WHATSAPP_SERVICE_URL=http://localhost:3003

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...

# Node
NODE_ENV=production
PORT=8080
```

---

## Portas Esperadas

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| API | 8080 / 3001 | Principal |
| WhatsApp | 3003 | Puppeteer/QR |
| Worker | 3000 | Background jobs |
| Frontend | 5173 | Vite dev server |

---

## Troubleshooting

### Chromium Not Found
```bash
# Alpine (Railway)
apk add chromium

# macOS
brew install chromium

# Ubuntu
apt-get install chromium
```

### Port Already in Use
```bash
# Encontrar processo nas portas
lsof -i :8080
lsof -i :3003
lsof -i :3000

# Matar processo
kill -9 <pid>
```

### Database Connection Error
Verifique `DATABASE_URL` no `.env`

---

## Commits Relacionados

- `74119f4` - CORS simplificado
- `08a4909` - railway.json removido (agora manual)
- `cfee429` - Documentação setup
