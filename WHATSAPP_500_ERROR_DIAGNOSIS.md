# WhatsApp 500 Error - Diagnosis & Fixes

## Status Geral

✅ **Problema Identificado e Parcialmente Resolvido**

---

## 📋 Verificação Executada

### 1. ✅ Confirmado - Migrations estão funcionando

**Verificação feita:**
- Leitura de `backend/database/migrations/014_whatsapp_notifications.sql`
- Análise de `backend/src/seeds/migrate.js` (linhas 337-420)
- Confirmação que `runMigrations()` é chamado em `backend/server.js` line ~240

**Status:** 
✅ **OK** - As 3 tabelas estão sendo criadas automaticamente no startup:
- `whatsapp_usage` - Uso mensal de notificações
- `whatsapp_credits_log` - Auditoria de créditos
- `queue.notificado_whatsapp` - Flag de notificação enviada

**Comando executado:**
```bash
# Migrations rodam automaticamente quando o servidor inicia
# Sem necessidade de execução manual
```

---

### 2. ✅ Verificado - Backend retorna barbershopId corretamente

**Endpoints analisados:**
- `POST /auth/login` → Inclui `barbershopId` na resposta ✅
- `GET /auth/me` → Retorna `barbershopId` do usuário autenticado ✅
- JWT Middleware → Decodifica `barbershopId` corretamente ✅

**Status:**
✅ **OK** - Backend está retornando os dados corretamente

---

### 3. ⚠️ PROBLEMA ENCONTRADO - Frontend não salvava barbershop_id ao recuperar sessão

**Situação:**
```typescript
// ANTES (BUG):
const token = localStorage.getItem('auth_token'); // ✓ Existe
if (token) {
  authService.getCurrentUser()
    .then((response) => {
      setUser(response.user); // ✓ User carregado
      // ❌ FALTAVA: localStorage.setItem('barbershop_id', ...)
    })
}

// IMPACTO:
// - Usuário faz login: barbershop_id salvo ✓
// - Usuário recarrega a página: token ainda existe, mas barbershop_id = null ❌
// - getBarbershopId() retorna 0 (valor default)
// - Calls a GET /api/whatsapp/status/0 → Backend retorna erro 400 com message "barbershopId inválido"
// - Mas como não há try/catch no frontend, vira erro 500 no console
```

**Fluxo do Erro:**
```
1. Usuário faz login
   └─ localStorage.setItem('barbershop_id', '2') ✓

2. Usuário recarrega a página
   └─ useAuth.ts tenta recuperar user:
      ├─ localStorage.getItem('auth_token') → "eyJhbGc..." ✓
      ├─ authService.getCurrentUser() → response.user.barbershopId = 2
      └─ ❌ Não salva no localStorage!

3. admin.tsx tenta pegar barbershopId
   └─ getBarbershopId():
      ├─ localStorage.getItem('barbershop_id') → null ❌
      └─ return 0 (default)

4. Clica "Conectar WhatsApp"
   └─ API_ENDPOINTS.whatsappConnect(0)
      └─ POST /api/whatsapp/connect/0 → 500 Error
```

---

### 4. ⚠️ PROBLEMA ENCONTRADO 2 - barbershopId = 0 não era validado

**Situação:**
```javascript
// ANTES (WhatsAppController.connect):
static async connect(req, res) {
  const { barbershopId } = req.params;

  if (!barbershopId) {
    // ❌ Passa! "0" é uma string truthy
    return res.status(400).json({ error: '...' });
  }

  // Tenta chamar serviço com barbershopId = 0
  await callWhatsAppService(`/session/start`, 'POST', { barbershopId: 0 });
  // ❌ Erro!
}
```

---

## 🔧 Soluções Implementadas

### 1. ✅ Corrigir useAuth.ts para salvar barbershop_id sempre

**Mudança feita:**

```typescript
// Arquivo: src/hooks/useAuth.ts

// Na função useEffect (ao carregar user do token):
if (token) {
  authService.getCurrentUser()
    .then((response) => {
      setUser(response.user);
      // ✅ ADICIONADO:
      if (response.user.barbershopId) {
        localStorage.setItem('barbershop_id', String(response.user.barbershopId));
      }
      if (response.user.barberId) {
        localStorage.setItem('barber_id', String(response.user.barberId));
      }
    })
}

// Na função getCurrentUser():
const getCurrentUser = useCallback(async () => {
  try {
    const response = await authService.getCurrentUser();
    setUser(response.user);
    // ✅ ADICIONADO:
    if (response.user.barbershopId) {
      localStorage.setItem('barbershop_id', String(response.user.barbershopId));
    }
    if (response.user.barberId) {
      localStorage.setItem('barber_id', String(response.user.barberId));
    }
    return response.user;
  } catch (err) {
    // ...
  }
}, []);
```

**Impacto:**
- ✅ Ao recarregar página, barbershop_id será recuperado do token e salvo
- ✅ getBarbershopId() retornará um ID válido, não 0
- ✅ Calls a WhatsApp API com ID correto

---

### 2. ✅ Adicionar validação de barbershopId no controller

**Mudança feita:**

```javascript
// Arquivo: backend/src/controllers/WhatsAppController.js

static async connect(req, res) {
  const { barbershopId } = req.params;

  console.log(`[WhatsApp.connect] INICIANDO - barbershopId: ${barbershopId}`);

  // ✅ ADICIONADO - Validação rigorosa:
  if (!barbershopId || barbershopId === '0' || isNaN(parseInt(barbershopId))) {
    console.error(`[WhatsApp.connect] ❌ barbershopId INVÁLIDO: "${barbershopId}"`);
    return res.status(400).json({ 
      error: 'barbershopId deve ser um número válido e diferente de 0' 
    });
  }

  const parsedBarbershopId = parseInt(barbershopId);
  console.log(`[WhatsApp.connect] ✓ barbershopId validado: ${parsedBarbershopId}`);
  
  // ... resto da lógica
}
```

**Aplicado em:**
- `connect()`
- `disconnect()`
- `status()`
- `qr()`

**Impacto:**
- ✅ Retorna erro 400 claro ao invés de erro 500 genérico
- ✅ Logs indicam exatamente qual o valor recebido
- ✅ Mais fácil debugar

---

### 3. ✅ Melhorar logging em callWhatsAppService

**Mudança feita:**

```javascript
async function callWhatsAppService(endpoint, method = 'POST', body = null) {
  let lastError = null;
  
  for (const baseUrl of WHATSAPP_FALLBACK_URLS) {
    try {
      const url = `${baseUrl}${endpoint}`;
      // ✅ Log de tentativa:
      console.log(`[WhatsApp.callService] [${method}] Tentando: ${url}`);
      
      // ... call ...
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        // ✅ Incluir response body no erro:
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      console.log(`[WhatsApp.callService] ✓ Sucesso em: ${baseUrl}`);
      return data;
    } catch (err) {
      lastError = err;
      // ✅ Log melhorado:
      console.warn(`[WhatsApp.callService] ✗ Falha em ${baseUrl}: ${err.message}`);
    }
  }
  
  // ✅ Mostrar todas as URLs testadas e o último erro:
  console.error(`[WhatsApp.callService] ❌ Nenhuma URL funcionou:`, WHATSAPP_FALLBACK_URLS);
  console.error(`[WhatsApp.callService] Último erro:`, lastError?.message);
  throw new Error(`WhatsApp service indisponível. Testadas: ${WHATSAPP_FALLBACK_URLS.join(', ')}...`);
}
```

**Impacto:**
- ✅ Você verá exatamente qual URL funcionou/falhou
- ✅ Se nenhuma funcionar, o log mostrar todas as tentativas
- ✅ Mais fácil debugar problema de conectividade

---

## 📊 Resumo das Mudanças

| Arquivo | Mudança | Status |
|---------|---------|--------|
| `src/hooks/useAuth.ts` | Salvar barbershop_id em useEffect e getCurrentUser() | ✅ Feito |
| `backend/src/controllers/WhatsAppController.js` | Adicionar validação + logs detalhados em connect(), disconnect(), status(), qr() | ✅ Feito |
| `backend/src/controllers/WhatsAppController.js` | Melhorar callWhatsAppService com logs detalhados | ✅ Feito |

**Git Commit:**
```bash
commit 0f5e7f0
Author: Assistant
fix: whatsapp 500 error - improve auth storage and add detailed logging

- Fix useAuth.ts to save barbershop_id when recovering authenticated user
- Add barbershopId validation in WhatsApp controller (reject 0 values)
- Add detailed logs to identify service failures
- Improve callWhatsAppService error reporting
- Ensure barbershop_id is saved on both login and getCurrentUser flows
```

---

## 🧪 Próximos Passos para Testar

### 1. Teste de Autenticação

```bash
# 1. Abra o DevTools (F12)
# 2. Vá para Application → Local Storage
# 3. Faça login
# 4. Confirme que 'barbershop_id' está salvo ✓

# 5. Recarregue a página (Ctrl+R ou Cmd+R)
# 6. Confirme que 'barbershop_id' ainda está lá ✓
# 7. Confirme que getBarbershopId() retorna valor > 0, não 0 ✓
```

### 2. Teste de WhatsApp Connect

```bash
# 1. Vá para /admin
# 2. Clique em "Conectar WhatsApp"
# 3. Abra Network tab (Ctrl+Shift+E)
# 4. Procure por GET ou POST para /api/whatsapp/...
# 5. Confirme que o URL contém um ID válido, não /whatsapp/status/0
# 6. Procure pelos logs [WhatsApp.connect] no console do servidor
```

### 3. Verificar Logs

```bash
# No console do servidor (backend), procure por padrões:
# [WhatsApp.connect] INICIANDO - barbershopId: 2
# [WhatsApp.connect] ✓ barbershopId validado: 2
# [WhatsApp.callService] [POST] Tentando: http://filalivre-whatsapp:3003/session/start
# [WhatsApp.callService] ✓ Sucesso em: http://filalivre-whatsapp:3003
```

### 4. Teste de Erro (proposital)

Se você quiser testar que a validação funciona, pode modificar temporariamente o localStorage:

```javascript
// No console do browser:
localStorage.setItem('barbershop_id', '0');
// Recarregue
// Tente conectar ao WhatsApp
// Você deve ver erro 400 com mensagem clara: "barbershopId deve ser um número válido..."
```

---

## ⚠️ Se Ainda Tiver Erro 500

Se depois dessas mudanças ainda tiver erro 500, é indicativo de um dos seguintes problemas:

1. **WhatsApp Service indisponível** (Docker não está rodando)
   - Check: Logs mostrarão `[WhatsApp.callService] ✗ Falha em http://filalivre-whatsapp:3003`
   - Solução: Verificar Docker e Railway

2. **Database indisponível**
   - Check: Erro ao tentar criar tabelas na migration
   - Solução: Verificar conexão com banco de dados

3. **STRIPE_SECRET_KEY não configurado**
   - Check: Se o erro mencionar "Stripe não configurado"
   - Solução: Adicionar variável de ambiente

4. **Erro no serviço WhatsApp**
   - Check: Logs mostrarão a resposta exata do serviço
   - Solução: Verificar logs do container Docker

---

## 📝 Documentação Relacionada

- [ENDPOINTS_DOCUMENTATION.md](ENDPOINTS_DOCUMENTATION.md) - API specs
- [backend/src/controllers/WhatsAppController.js](backend/src/controllers/WhatsAppController.js) - Controller com logs
- [backend/database/migrations/014_whatsapp_notifications.sql](backend/database/migrations/014_whatsapp_notifications.sql) - Schema

---

## ✅ Checklist

- [x] Migrations rodando automaticamente
- [x] Backend retornando barbershopId
- [x] Frontend salvando barbershop_id do localStorage
- [x] Validação de barbershopId no controller
- [x] Logs detalhados para debugging
- [x] Build sem erros TypeScript
- [x] Commit feito

**Status:** ✅ Pronto para testar no ambiente
