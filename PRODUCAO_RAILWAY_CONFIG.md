# Configuração de Produção - Railway

## Variáveis de Ambiente para Railway

Quando fazer deploy para Railway, configure cada serviço com as seguintes variáveis:

### filalivre-api

```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://filalivre.app.br

# IMPORTANTE: Em Railway, usar domínio interno (rede privada)
WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003

# Demais variáveis (cópia de .env)
DB_HOST=interchange.proxy.rlwy.net
DB_PORT=37118
DB_USER=root
DB_PASS=<DECRYPT_FROM_RAILWAY>
DB_NAME=railway
JWT_SECRET=<KEEP_FROM_LOCAL>
JWT_EXPIRES_IN=7d
...
```

### filalivre-worker

```env
NODE_ENV=production

# IMPORTANTE: Em Railway, usar domínio interno (rede privada)
WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003
WORKER_INTERVAL=10000

# Database (mesmas credenciais da API)
DB_HOST=interchange.proxy.rlwy.net
DB_PORT=37118
DB_USER=root
DB_PASS=<DECRYPT_FROM_RAILWAY>
DB_NAME=railway
```

### filalivre-whatsapp

```env
WHATSAPP_PORT=3003
NODE_ENV=production

# Database (mesmas credenciais da API)
DB_HOST=interchange.proxy.rlwy.net
DB_PORT=37118
DB_USER=root
DB_PASS=<DECRYPT_FROM_RAILWAY>
DB_NAME=railway
```

---

## ⚠️ DIFERENÇA: Local vs Production

### Local (seu computador)
```
WHATSAPP_SERVICE_URL=http://localhost:3003
```
✅ Funciona porque todos os serviços rodam no mesmo computador

### Production (Railway)
```
WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003
```
✅ Funciona porque Railway resolve `filalivre-whatsapp` para IP interno do serviço

---

## 🔄 Fluxo de Comunicação Interna (Production)

```
┌─────────────────────────────────────────────────────┐
│  Railway Private Network                             │
│                                                     │
│  filalivre-api (:3001)                             │
│      │                                              │
│      │ fetch("http://filalivre-whatsapp:3003")     │
│      ▼                                              │
│  filalivre-whatsapp (:3003) ✅ RESPONDE           │
│                                                     │
│  filalivre-worker                                  │
│      │                                              │
│      │ fetch("http://filalivre-whatsapp:3003")     │
│      ▼                                              │
│  filalivre-whatsapp (:3003) ✅ RESPONDE           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Passo a Passo para Railway

1. **Para cada serviço em Railway UI:**
   - Ir em: Settings → Deploy → Environment
   - Adicionar/atualizar: `WHATSAPP_SERVICE_URL=http://filalivre-whatsapp:3003`
   - Salvar

2. **Verificar que está correto:**
   - filalivre-api → WHATSAPP_SERVICE_URL: `http://filalivre-whatsapp:3003`
   - filalivre-worker → WHATSAPP_SERVICE_URL: `http://filalivre-whatsapp:3003`
   - filalivre-whatsapp → (não precisa, é o alvo)

3. **Fazer redeploy:**
   - Clique em "Deploy" na Railway UI
   - Aguarde que os 3 services façam redeploy

4. **Testar:**
   ```bash
   curl https://filalivre-api.up.railway.app/api/whatsapp/status/1
   # Esperado: resposta JSON com status do WhatsApp
   ```

---

## 🐛 Troubleshooting

### Se API ainda diz "Serviço WhatsApp indisponível"

1. Verifique se `filalivre-whatsapp` está com status ✅ (verde) em Railway
2. Verifique se variável `WHATSAPP_SERVICE_URL` em filalivre-api é `http://filalivre-whatsapp:3003`
3. Aguarde 1-2 minutos após redeploy (Railway demora para resolver DNS interno)
4. Verifique logs do serviço na Railway UI

### Se WhatsApp não inicia

1. Verifique se `WHATSAPP_PORT=3003` está configurado
2. Verifique variáveis de banco de dados
3. Verifique logs procurando por erros de porta

---

## 📝 Resumo

| Ambiente | WHATSAPP_SERVICE_URL | Porta |
|----------|---|---|
| Local (seu PC) | `http://localhost:3003` | 3003 |
| Railway nodes | `http://filalivre-whatsapp:3003` | 3003 |

**IMPORTANTE:** Mudar a URL quando fizer deploy!
