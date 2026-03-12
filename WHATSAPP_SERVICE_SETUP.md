# WhatsApp Service - Setup Manual

O serviço WhatsApp está **DESCONECTADO** do `railway.json` principal.

## Status Atual

- ✅ **API Principal** → `railway.json` → `node server.js` (porta 3001/8080)
- ⏳ **WhatsApp Service** → Manual → `node server.whatsapp.js` (porta 3003)

---

## Como Rodar o WhatsApp Service Manualmente

### Opção 1: Railway CLI (Recomendado)

```bash
# 1. Acesse a pasta do backend
cd backend

# 2. Rode o serviço WhatsApp manualmente
railway run node server.whatsapp.js
```

### Opção 2: Criar Novo Serviço no Railway (Melhor para Produção)

1. No painel Railway, clique em **"Create New Service"**
2. Vincule o mesmo repositório GitHub
3. Crie um novo `railway.json` apenas para WhatsApp:

```json
{
  "build": {
    "builder": "dockerfile",
    "context": "."
  },
  "deploy": {
    "startCommand": "node server.whatsapp.js",
    "restartPolicyMaxRetries": 5,
    "restartPolicyWindowSeconds": 600
  }
}
```

4. Salve como `railway-whatsapp.json` ou use **Service Override** no painel

### Opção 3: Docker Direto

```bash
cd backend

# Build
docker build -t filalivre-whatsapp .

# Run
docker run -p 3003:3003 \
  -e PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
  filalivre-whatsapp \
  node server.whatsapp.js
```

---

## Verificar Conectividade

```bash
# Health check
curl https://<seu-whatsapp-service-url>/health

# Ping
curl https://<seu-whatsapp-service-url>/ping

# Ver QR (sem sessão)
curl https://<seu-whatsapp-service-url>/qr/test
```

---

## Variáveis de Ambiente

O `server.whatsapp.js` precisa de:

```env
PORT=3003
NODE_ENV=production
```

---

## Estrutura de Portas

```
frontend (filalivre.app.br)
    ↓
API Principal (3001/8080) ← railway.json
    ↓ (proxy)
WhatsApp Service (3003) ← Manual ou Novo Serviço
    ↓
Puppeteer → WhatsApp Web
```

---

## Próximos Passos

1. ✅ API Principal rodando via `railway.json`
2. ⏳ Inicie WhatsApp Service manualmente
3. ✅ Teste o QR code no dashboard

