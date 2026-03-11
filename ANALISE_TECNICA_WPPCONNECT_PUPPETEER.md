# Análise Técnica: Investigação de Conectividade do WPPConnect/Puppeteer no Railway

**Versão:** 1.0  
**Data:** 11 de março de 2026  
**Status:** Análise técnica completa (sem modificações ao código)  
**Objetivo:** Investigar por que a API não consegue se comunicar com o serviço WhatsApp em produção

---

## 1. SUMÁRIO EXECUTIVO

### Problema Diagnosticado
A API consegue se comunicar com o serviço WhatsApp em desenvolvimento (localhost), mas em produção (Railway) **todos os endpoints do WhatsApp retornam `TypeError: fetch failed`**, mesmo quando ambos os serviços estão reportados como "Active".

### Hipótese Principal
**O problema é muito provavelmente relacionado a dependências de sistema não disponíveis no ambiente Nixpacks do Railway**, não a problemas de rede ou configuração.

### Evidência-Chave
O arquivo `server.whatsapp.js` usa `wppconnect` que depende de **Puppeteer/Chromium**, que requer várias bibliotecas de sistema Linux. Estas **não estão instaladas** no runtime Nixpacks padrão usado pelo Railway.

---

## 2. ARQUITETURA ATUAL DO PROJETO

### Componentes
```
filalivre-production (projeto Railway)
├── filalivre-api (port 8080) - Node.js Express
├── filalivre-worker - Node.js background processor
└── filalivre-whatsapp (port 3003) - Node.js + WPPConnect + Puppeteer
```

### Fluxo de Comunicação
```
1. API inicia normalmente em port 8080
2. API tenta chamar WhatsApp via HTTP em localhost:3003
3. WhatsApp service inicia, binding confirmado em 0.0.0.0:3003
4. Mas quando API tenta fazer fetch para /ping, falha com "TypeError: fetch failed"
```

### Logs Atuais

**WhatsApp service (observado em Railway logs):**
```
✓ BINDING CONFIRMADO: 0.0.0.0:3003
✓ Database connected successfully
✓ Servidor pronto para receber requisições
Status: Active
```

**API diagnostics (via /api/whatsapp-diagnostic):**
```json
{
  "ping_endpoint": [
    {
      "url": "http://filalivre-whatsapp:3003",
      "status": "FAILED",
      "error": "TypeError: fetch failed"
    }
  ]
}
```

---

## 3. ANÁLISE: DEPENDÊNCIAS DO WPPCONNECT

### 3.1 O que é WPPConnect?

WPPConnect v1.41.0 é uma biblioteca Node.js que:
- Automatiza WhatsApp Web usando **Puppeteer** (navegador headless automatizado)
- Controla uma instância do **Chromium** ou **Chrome** dentro do processo Node.js
- Gerencia sessões de autenticação QR code
- Envia/recebe mensagens via WebSocket simulado

### 3.2 Dependências Diretas (npm)
```json
{
  "@wppconnect-team/wppconnect": "^1.41.0",
  "puppeteer": "^24.37.5",
  "puppeteer-extra": "^3.3.6",
  "puppeteer-extra-plugin-stealth": "^2.11.2"
}
```

### 3.3 Dependências de Sistema (CRÍTICAS)

#### Bibliotecas Linux Necessárias

WPPConnect usa Chromium, que é um **navegador multi-processo que requer X11 e bibliotecas gráficas completas**:

| Biblioteca | Propósito |
|-----------|-----------|
| `libx11-6`, `libx11-xcb1` | X11 Window System |
| `libxcomposite1`, `libxdamage1` | Compositing |
| `libxfixes3`, `libxrandr2` | Window management |
| `libgtk-3-0` | GUI Toolkit |
| `libibnss3` | SSL/TLS (crítico para HTTPS WhatsApp) |
| `libgconf-2-4` | Configuration |
| `libatk1.0-0` | Accessibility |
| `libcairo2` | Graphics |
| `libcups2` | Print support |
| `libdbus-1-3` | IPC |
| `libexpat1` | XML parsing |
| `libfontconfig1` | Font |
| `libgdk-pixbuf2.0-0` | Image handling |
| `libglib2.0-0` | Core library |
| `libpango-1.0-0` | Text rendering |

#### Ferramentas Adicionais ('buildpack')

```bash
# FFmpeg - CRÍTICO para processar mídia (imagens, vídeos, áudio)
ffmpeg

# Fonts - Necessário para rendering de texto
fonts-liberation
```

### 3.4 Configuração Puppeteer no código

**Arquivo:** [backend/src/services/WhatsAppService.js](backend/src/services/WhatsAppService.js#L55-L67)

```javascript
const client = await wppconnect.create({
  session: sessionName,
  headless: true,
  useChrome: false,
  logQR: true,
  browserArgs: [
    '--no-sandbox',                    // Container security model
    '--disable-setuid-sandbox',        // Disable SUID sandbox
    '--disable-dev-shm-usage',         // Important for limited /dev/shm
    '--disable-gpu',                   // No GPU acceleration
    '--no-first-run',
    '--no-zygote',                     // Disable process forking
    '--single-process',                // Run in single process (containers)
  ],
});
```

---

## 4. AMBIENTE RAILWAY NIXPACKS

### 4.1 O que é Nixpacks?

Nixpacks é um build system que **Railway usa** para compilar aplicações Node.js. Ele:
- Detecta a aplicação (Node.js, Python, etc)
- Prepara um ambiente de runtime baseado em Nix
- Cria um container OCI

### 4.2 Runtime Default do Node.js no Railway

**Baseado em:** nixpacks.com/docs/providers/node

O runtime padrão do Nixpacks para Node.js:
- ✅ Instala Node.js (versão configurável, padrão 18)
- ✅ Instala npm/yarn
- ✅ Instala dependências npm (package.json)
- ❌ **NÃO instala bibliotecas de sistema extras** (chromium, ffmpeg, libgtk, etc)
- ❌ **NÃO instala build tools** por padrão

### 4.3 Verificação do nixpacks.toml Atual

**Arquivo:** [backend/nixpacks.toml](backend/nixpacks.toml)

```toml
# Config for Railway Nixpacks builder
# Note: filalivre-api does NOT need Chromium
# filalivre-whatsapp service needs its own nixpacks.toml with Chromium

[phases.setup]
# No extra packages needed for the API
```

**Problema:** 
- ❌ Arquivo está vazio/incompleto
- ❌ Não especifica dependências de sistema para nenhum serviço
- ❌ Comentário menciona que WhatsApp precisa de Chromium, mas não implementa

### 4.4 Por que Railway Nixpacks Não Incluiria Chromium

1. **Não é instalado por padrão** - O Node.js buildpack não inclui navegadores
2. **É pesado demais** (300MB+) - Aumentaria imensamente o tamanho da image
3. **Requer configuração explícita** - Deve ser solicitado via nixpacks.toml
4. **Muitas dependências** - Conforme listado em 3.3

---

## 5. DIAGNÓSTICO DO ERRO "TypeError: fetch failed"

### 5.1 O que significa "fetch failed"?

Quando Puppeteer não consegue iniciar:

```javascript
// Em WhatsAppService.js:23
const client = await wppconnect.create({...})
// ↓
// Puppeteer tenta executar: /usr/bin/chromium-browser
// ↓
// Falha porque:
//   - Chromium não está instalado
//   - OU Chromium tenta carregar libgt ksGtk e libx11 que não existem
//   - OU Chromium não consegue alocar memória compartilhada
```

### 5.2 Cascata de Falhas

```
1. WhatsApp service inicia normalmente (binding funciona)
2. WhatsApp tenta executar wppconnect.create()
3. Puppeteer procura por Chromium em:
   - /usr/bin/chromium ❌ (não existe)
   - /usr/bin/chromium-browser ❌ (não existe)
   - Cai para bundled Chromium do Puppeteer
4. Puppeteer extrai Chromium (~400MB)
5. Puppeteer tenta inicializar Chromium
6. Chromium carrega libgtk-3-0 → ERRO (não instalado)
7. Chromium falha silenciosamente
8. WhatsApp service fica rodando sem conectar
9. Endpoints do WhatsApp respondem (binding funciona)
10. MAS wppconnect nunca fica pronto
11. Qualquer operação que precise de uma sessão ativa falha
```

**Por isso a API vê:**
- ✅ `/ping` responde (endpoint Express simples)
- ✅ `/health` responde (endpoint simples)
- ✅ `/ready` responde (endpoint simples)
- ❌ `/connect` falha (precisa criar sessão WPPConnect)
- ❌ `/send` falha (precisa de sessão ativa)

### 5.3 Por que Network Ping Falha?

Se o erro "fetch failed" ocorre mesmo para `/ping` (que não precisa de Chromium), então o problema é:

**HIPÓTESE CORRIGIDA:** O serviço WhatsApp pode estar crashando completamente durante inicialização quando tenta:
1. Executar `startAllSessions()` 
2. Carregar sessões do banco de dados
3. Chamar `wppconnect.create()` sem ter Chromium

**Resultado:** Serviço morre, porta fica disponível mas sem processo respondendo.

---

## 6. POR QUE FUNCIONAVA ANTES (Monolítico)

**Antes (monolítico no mesmo host):**
```
Node.js app.js → wppconnect integrado → Chromium local
↓ (tudo no mesmo processo)
Funciona porque o ambiente de desenvolvimento tem:
  - libgtk-3-0 (instalado via apt-get)
  - libx11-6, libnss3 (dependências do desktop)
  - FFmpeg (para mídia)
  - Espaço em disco para Chromium cache
```

**Depois (microserviços em Railway):**
```
filalivre-api (port 8080)  ✓ Funciona
      ↕ fetch http://filalivre-whatsapp:3003
filalivre-whatsapp (port 3003) ✗ Morre ao inicializar
  └─ wppconnect.create()
     └─ Puppeteer.launch()
        └─ Chromium binary
           └─ libgtk-3-0 missing → CRASH
```

---

## 7. VALIDAÇÃO DA HIPÓTESE

### Evidência 1: Arquivo WhatsAppService.js
```javascript
const chromiumPath = getChromiumPath();
if (chromiumPath) {
    console.log('[WhatsApp] Usando Chromium do sistema:', chromiumPath);
}
```

Se este log **não aparecer em Railway**, significa:
- Chromium não foi encontrado em `/usr/bin/chromium` (esperado)
- Está tentando usar bundled Chromium do Puppeteer
- Qual depois falha porque as bibliotecas não existem

### Evidência 2: Estrutura do Projeto
- ✅ `server.whatsapp.js` importa WPPConnect na linha 1
- ✅ `WhatsAppService.js` chama `wppconnect.create()` sem try-catch
- ✅ Sem tratamento de erro inicial
- ✅ Processo provavelmente morre silenciosamente

### Evidência 3: Logs da API
Se o diagnostic endpoint fosse executado:
```javascript
const response = await fetch('http://filalivre-whatsapp:3003/ping');
// TypeError: fetch failed
```

Isto sugere que **a porta está disponível mas nenhum processo está respondendo**.

---

## 8. RECOMENDAÇÃO: NIXPACKS vs DOCKER

### 8.1 Opção A: Configurar Nixpacks (RÁPIDO, RECOMENDADO PRIMEIRO)

**Vantagem:**
- Integrado nativamente com Railway
- Não precisa manter Dockerfile
- Build otimizado

**Desvantagem:**
- Sintaxe Nix é complexa
- Menos controle sobre detalhes de sistema

**Implementação:**
```toml
# backend/nixpacks.toml
[phases.setup]
# Instalar dependências de Chromium
nixpkgs = ["chromium", "ffmpeg", "libgtk3", ...]
```

### 8.2 Opção B: Docker (MAIS CONTROLE, MAIS PESO)

**Vantagem:**
- Controle total sobre dependências
- Transparente (arquivo Dockerfile)
- Reutilizável em outros ambientes

**Desvantagem:**
- Aumenta tamanho da image (~800MB+)
- Requer manutenção do Dockerfile
- Build mais lento

**Dockerfile Necessário:**
```dockerfile
FROM node:18-alpine

# Instalar Chromium + dependências
RUN apk add --no-cache \
  chromium \
  ffmpeg \
  libgtk-3 \
  libx11 \
  ... (13+ bibliotecas)

WORKDIR /app
COPY backend /app
RUN npm ci --only=production

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3003
CMD ["node", "server.whatsapp.js"]
```

### 8.3 Recomendação Final

1. **PRIMEIRO:** Tentar Nixpacks (8.1)
   - Menos invasivo
   - Mais rápido de testar
   - Se falhar, ir para Docker

2. **SE NECESSÁRIO:** Usar Docker (8.2)
   - Mais seguro (você controla tudo)
   - Melhor para debugging
   - Mais pesado mas garantido funcionar

---

## 9. PLANO DE TESTE EXPERIMENTAL

### 9.1 Teste Local (Valida Hipótese)

**Objetivo:** Confirmar se Puppeteer/WPPConnect funciona com as dependências corretas.

**Passo 1: Preparar Ambiente Local**
```bash
cd /Users/edsonfelix/Documents/Freelas/filalivre/backend

# Instalar Chromium + FFmpeg (macOS)
brew install chromium ffmpeg

# OU (Linux/Ubuntu)
sudo apt-get install -y \
  chromium-browser \
  ffmpeg \
  libgtk-3-0 \
  libx11-6 \
  libnss3
```

**Passo 2: Criar Script de Teste**
```javascript
// backend/test-wppconnect.js
import wppconnect from '@wppconnect-team/wppconnect';

(async () => {
  try {
    console.log('Iniciando WPPConnect...');
    const client = await wppconnect.create({
      session: 'test-session',
      headless: true,
      logQR: true,
      browserArgs: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('✓ WPPConnect iniciado com sucesso!');
    console.log('✓ Chromium respondendo');
    
    // Teste de endpoint
    const status = await client.getStatus();
    console.log('✓ Status:', status);
    
  } catch (err) {
    console.error('✗ Erro ao iniciar WPPConnect:');
    console.error(err.message);
    console.error(err.stack);
  }
})();
```

**Passo 3: Executar Teste**
```bash
node backend/test-wppconnect.js
```

**Resultados Esperados:**
- ✅ Se funcionar: Hipótese confirmada (faltam dependências no Railway)
- ❌ Se falhar: Problema é diferente (investigação adicional necessária)

### 9.2 Teste no Railway (Com Nixpacks)

**Depois de configurar nixpacks.toml:**

```bash
# 1. Commit das mudanças
cd /Users/edsonfelix/Documents/Freelas/filalivre
git add backend/nixpacks.toml
git commit -m "chore: add Chromium dependencies to nixpacks.toml

- Install chromium, ffmpeg for WhatsApp service
- Configure PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
- Test hypothesis: dependencies missing in Railway"
git push

# 2. Railway redeploy automático (ou manualmente na UI)

# 3. Verificar logs
# - CLI: railway logs filalivre-whatsapp
# - UI: filalivre-production → Service → Logs

# 4. Testar endpoint
curl https://filalivre-production.up.railway.app/api/whatsapp-diagnostic
```

### 9.3 Teste com Docker (Se Nixpacks Falhar)

```bash
# 1. Criar Dockerfile para só WhatsApp
cat > backend/Dockerfile.whatsapp << 'EOF'
FROM node:18-alpine

RUN apk add --no-cache \
  chromium \
  ffmpeg \
  libgtk-3 \
  libx11 \
  libnss3

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV WHATSAPP_PORT=3003

EXPOSE 3003
CMD ["node", "server.whatsapp.js"]
EOF

# 2. Build local para teste
docker build -t filalivre-whatsapp:test \
  -f backend/Dockerfile.whatsapp \
  backend/

# 3. Testar localmente
docker run -p 3003:3003 filalivre-whatsapp:test
```

---

## 10. CHECKLIST DE INVESTIGAÇÃO

- [ ] **Verificar Railway logs** - Procurar por erros de Chromium/Puppeteer ao inicializar
- [ ] **Executar teste local** (9.1) - Confirmar que WPPConnect funciona com dependências
- [ ] **Configurar Nixpacks** (8.1) - Adicionar dependências para serviço WhatsApp
- [ ] **Deploy teste no Railway** - Verificar se Nixpacks resolve
- [ ] **Se Nixpacks falhar** - Preparar Dockerfile (8.2)
- [ ] **Validar timeout de inicialização** - WhatsApp pode estar levando > 30s para inicializar
- [ ] **Verificar memória** - Railway oferece 512MB+? (Chromium + Node precisa ~400MB)

---

## 11. PRÓXIMAS AÇÕES (SEM MODIFICAÇÕES AINDA)

1. **Esta semana:**
   - [ ] Executar script de teste local (9.1)
   - [ ] Confirmar hipótese com Railway logs
   - [ ] Documentar exato erro de Chromium

2. **Próxima semana:**
   - [ ] Configurar nixpacks.toml com dependências
   - [ ] Ou preparar Dockerfile alternativo
   - [ ] Deploy teste
   - [ ] Validação em produção

3. **Time:**
   - Este documento é insumo para decisão arquitetural
   - Não modifica código até validação concluir

---

## Apêndice A: Recurso de Referência

### WPPConnect v1.41.0
- **Repositório:** https://github.com/wppconnect-team/wppconnect
- **npm:** `@wppconnect-team/wppconnect`
- **Puppeteer:** v24.37.5

### Railway Nixpacks
- **Documentação:** https://nixpacks.com/docs
- **Providers:** https://nixpacks.com/docs/providers/node
- **Nix Packages:** https://search.nixos.org/packages

### Recursos Relacionados
- Chromium headless: https://github.com/puppeteer/puppeteer
- FFmpeg: https://ffmpeg.org
- Puppeteer troubleshooting: https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md

---

## Apêndice B: Configuração Puppeteer Recomendada para Containers

```javascript
// Solução otimizada para containers
const containerArgs = [
  '--no-sandbox',                      // Crit ical for containers
  '--disable-setuid-sandbox',          // Disable SUID
  '--disable-dev-shm-usage',           // For limited /dev/shm
  '--disable-gpu',                     // No GPU in containers
  '--disable-software-rasterizer',     // No software rendering
  '--disable-extensions',              // Disable extensions
  '--no-first-run',                    // Skip first run
  '--no-default-browser-check',        // Skip checks
  '--disable-infobars',                // No infobars
  '--disable-translate',               // No translation
  '--no-zygote',                       // Single process mode
];
```

---

**Análise Técnica Concluída sem modificações ao código.**  
**Aguardando validação experimental antes de implementação.**
