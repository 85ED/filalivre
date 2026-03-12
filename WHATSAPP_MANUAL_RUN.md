# Como Rodar Manualmente

## Comando Rápido para WhatsApp Service no Railway

```bash
# 1. Entrar na pasta do projeto
cd /Users/edsonfelix/Documents/Freelas/filalivre/backend

# 2. Rodar o serviço WhatsApp manualmente via Railway CLI
railway run node server.whatsapp.js
```

## Ou Criar um Novo Serviço no Railway

1. No painel Railway: **New Service** → **GitHub Repository**
2. Selecione o mesmo repo `filalivre`
3. Após criar, vá em **Settings** → **Source**
4. Coloque este token/comando como override:
   ```
   startCommand: node server.whatsapp.js
   ```

## Ou Usar o Arquivo Separado

Se quiser manter organized:
- Arquivo: `backend/railway-whatsapp.json`
- Contém a configuração para rodar APENAS o WhatsApp

---

## Verificar Portas

- **API Principal**: `:8080` ou `:3001`
- **WhatsApp Service**: `:3003`

Ambas rodando em paralelo quando você executar.

---

## Status Atual (12 de março, 2026)

✅ API Principal: `railway.json` → `node server.js`
⏳ WhatsApp Service: Aguardando comando manual `node server.whatsapp.js`
