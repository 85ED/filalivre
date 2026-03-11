# Teste Experimental Mínimo: Validar WPPConnect em Isolamento

**Objetivo:** Confirmar se Puppeteer/Chromium está faltando no Railway verificando localmente  
**Tempo Estimado:** 15-30 minutos  
**Risco:** Nenhum (teste local, sem modificações de código)

---

## Teste 1: Verificar Bundled Chromium do Puppeteer Localmente

### Passo 1.1: Criar Script de Diagnóstico

```bash
cd /Users/edsonfelix/Documents/Freelas/filalivre/backend

cat > test-puppeteer-deps.js << 'EOF'
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

console.log('=== DIAGNÓSTICO: Dependências de Chromium/Puppeteer ===\n');

// Teste 1: Procurar Chromium do sistema
console.log('1. Procurando Chromium do sistema:');
const chromiumPaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

let foundChromium = null;
for (const p of chromiumPaths) {
  if (existsSync(p)) {
    console.log(`   ✓ Encontrado: ${p}`);
    foundChromium = p;
  }
}

if (!foundChromium) {
  console.log('   ✗ Nenhum Chromium do sistema encontrado');
}

// Teste 2: Testar Puppeteer
console.log('\n2. Testando Puppeteer:');
try {
  const puppeteer = await import('puppeteer');
  console.log(`   ✓ Puppeteer importado com sucesso`);
  console.log(`   Versão: ${puppeteer.default.default?.version || 'desconhecida'}`);
} catch (err) {
  console.log(`   ✗ Erro ao importar Puppeteer: ${err.message}`);
}

// Teste 3: Testar WPPConnect
console.log('\n3. Testando WPPConnect:');
try {
  const wppconnect = (await import('@wppconnect-team/wppconnect')).default;
  console.log('   ✓ WPPConnect importado com sucesso');
} catch (err) {
  console.log(`   ✗ Erro ao importar WPPConnect: ${err.message}`);
}

// Teste 4: Procurar Chromium extraído do Puppeteer
console.log('\n4. Procurando Chromium extraído do Puppeteer:');
const chromiumCache = path.join(
  process.env.HOME,
  '.cache/puppeteer'  // Linux/macOS
);

if (existsSync(chromiumCache)) {
  console.log(`   ✓ Diretório cache encontrado: ${chromiumCache}`);
  try {
    const files = execSync(`find "${chromiumCache}" -type f -name "chrome*" 2>/dev/null | head -5`, { encoding: 'utf-8' });
    console.log(`   ${files.split('\n').filter(l => l).length} arquivos Chromium encontrados`);
  } catch (err) {
    console.log('   ✗ Erro ao listar arquivos');
  }
} else {
  console.log(`   ✗ Nenhum cache Chromium em ${chromiumCache}`);
}

// Teste 5: Testar lançamento mínimo
console.log('\n5. Teste de lançamento mínimo do Puppeteer:');
try {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  console.log('   ✓ Puppeteer browser inicializado com sucesso!');
  await browser.close();
} catch (err) {
  console.log(`   ✗ Erro ao lançar browser: ${err.message}`);
  console.log(`   Dica: Faltam dependências de sistema?`);
}

console.log('\n=== FIM DO DIAGNÓSTICO ===');
EOF

# Executar
node test-puppeteer-deps.js
```

### Passo 1.2: Interpretar Resultados

| Resultado | Significado | Próximo Passo |
|-----------|-----------|---------------|
| ✓ Chromium encontrado | Sistema tem Chromium | Railway pode não ter |
| ✗ Nenhum Chromium | Depende de Puppeteer extrair | Verifique Node modules |
| ✓ Puppeteer importado | Dependência npm ok | Validar sistema |
| ✓ Browser inicializado | Tudo funciona localmente | Problema é Railway |
| ✗ Erro "Missing dependencies" | Faltam libs do sistema | Instalar chromium/ffmpeg |

---

## Teste 2: Simular Ambiente Railway Localmente (Docker)

### Passo 2.1: Build Mínimo sem Chromium (simula Railway Nixpacks)

```bash
cd /Users/edsonfelix/Documents/Freelas/filalivre/backend

# Criar Dockerfile que simula ambiente Railway
cat > Dockerfile.test-without-chromium << 'EOF'
FROM node:18-alpine

# Não instala chromium, ffmpeg, gtk - simula Railway padrão
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
COPY .env .env

ENV WHATSAPP_PORT=3003
EXPOSE 3003

CMD ["node", "server.whatsapp.js"]
EOF

# Build imagem teste
docker build -t fila-whatsapp-no-deps -f Dockerfile.test-without-chromium .

# Executar e observar
echo "Iniciando... aguarde 10 segundos e interrompa com Ctrl+C:"
docker run --rm fila-whatsapp-no-deps 2>&1 | head -20

# Esperado se hipótese estiver correta:
# - Serviço inicia normalmente
# - Porto 3003 bind confirmado
# - Depois tenta carregar wppconnect
# - Cromium falha silenciosamente
# - OU erro explícito sobre libgtk/libnss3
```

### Passo 2.2: Build COM Chromium (valida solução)

```bash
cat > Dockerfile.test-with-chromium << 'EOF'
FROM node:18-alpine

# Instala Chromium + FFmpeg (solução proposta)
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
COPY .env .env

ENV WHATSAPP_PORT=3003
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3003
CMD ["node", "server.whatsapp.js"]
EOF

# Build imagem
docker build -t fila-whatsapp-with-deps -f Dockerfile.test-with-chromium .

# Executar
echo "Iniciando com dependências instaladas..."
docker run --rm fila-whatsapp-with-deps 2>&1 | head -30

# Esperado:
# - Serviço inicia normalmente
# - Sessões carregadas do banco
# - Chromium encontrado e inicializado
# - Nenhum erro de dependência
```

### Passo 2.3: Testar Comunicação Entre Containers

```bash
# Terminal 1: Iniciar serviço WhatsApp
docker run -d \
  --name fila-whatsapp-test \
  -p 3003:3003 \
  -e WHATSAPP_PORT=3003 \
  -e NODE_ENV=production \
  fila-whatsapp-with-deps

# Aguardar inicialização
sleep 5

# Terminal 2: Testar conectividade
curl -v http://localhost:3003/ping
curl -v http://localhost:3003/health
curl -v http://localhost:3003/ready

# Esperado: 200 OK de todos os endpoints

# Verificar logs
docker logs fila-whatsapp-test | grep -E "BINDING|connected|error"

# Parar
docker stop fila-whatsapp-test && docker rm fila-whatsapp-test
```

---

## Teste 3: Validar Hipótese com Railway Logs

### Passo 3.1: Coletar Logs Detalhados

```bash
# Usar Railway CLI
railway login

# Listar projetos
railway projects

# Selecionar projeto
railway project select filalivre-production

# Coletar logs do serviço WhatsApp
railway logs filalivre-whatsapp --tail 100 > whatsapp-logs.txt

# Procurar por erros críticos
grep -E "ENOENT|EACCES|libgtk|libnss|chromium|error|failed" whatsapp-logs.txt
```

### Passo 3.2: Indicadores-Chave nos Logs

**Procure por:**

```
❌ Problema se vir:
"Error while loading shared libraries: libgtk-3.so.0"
"Error while loading shared libraries: libnss3.so"
"Failed to launch the browser process"
"spawn ENOENT"
"Cannot find module 'chromium'"

✓ Confirmação se ver:
"Chromium do sistema: /usr/bin/chromium"
"Usando Chromium bundled do Puppeteer"
"Database connected"
"Sessões restauradas com sucesso"
```

---

## Teste 4: Teste de QR Code Simples

### Passo 4.1: Criar Endpoint de Teste QR

```javascript
// backend/test-qr.js
import wppconnect from '@wppconnect-team/wppconnect';

try {
  console.log('[TEST] Iniciando WPPConnect com QR gerador...');
  
  const client = await wppconnect.create({
    session: 'test-qr-session-' + Date.now(),
    catchQR: (qr) => {
      console.log('[TEST] ✓ QR Code gerado com sucesso!');
      console.log('[TEST] Dados QR (primeira 50 chars):', qr.substring(0, 50) + '...');
      process.exit(0);
    },
    headless: true,
    browserArgs: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  // Se não gerar QR em 30s, assumir já conectado
  setTimeout(() => {
    console.log('[TEST] Nenhum QR em 30s (talvez já conectado)');
    process.exit(0);
  }, 30000);
  
} catch (err) {
  console.error('[TEST] ✗ Erro:', err.message);
  console.error('[TEST] Stack:', err.stack);
  process.exit(1);
}
```

### Passo 4.2: Executar Teste

```bash
cd /Users/edsonfelix/Documents/Freelas/filalivre/backend

# Local (com dependências)
node test-qr.js

# No Docker (com deps)
docker run --rm fila-whatsapp-with-deps node test-qr.js

# No Docker (sem deps - esperado falhar)
docker run --rm fila-whatsapp-no-deps node test-qr.js
```

---

## Checklist de Resultados

- [ ] **Teste 1.2:** Puppeteer browser inicializado = deps podem estar ok localmente
- [ ] **Teste 2.1:** Sem Chromium fallha com lib error = HIPÓTESE CONFIRMADA
- [ ] **Teste 2.2:** Com Chromium funciona = SOLUÇÃO VALIDADA
- [ ] **Teste 3.2:** Logs Railway mostram lib error = CONFIRMAÇÃO FINAL
- [ ] **Teste 4.2:** QR gerado com sucesso = Puppeteer totalmente funcional

---

## Resultado da Investigação

Após estes testes:

- **SE testes 2.1 falhar e 2.2 passar:** Problema é definitivamente falta de dependências no Railway. Implementar solução (Nixpacks ou Docker).

- **SE todos os testes passarem localmente mas Railway ainda falhar:** Problema é diferente (memória, timeout, network policy). Investigação adicional.

- **SE teste QR 4.2 gerar QR:** WPPConnect totalmente funcional, comunicação API ↔ WhatsApp deve funcionar.

---

## Script Automatizado (Opcional)

```bash
#!/bin/bash
# backend/run-all-tests.sh

echo "🧪 Executando todos os testes..."

echo -e "\n📋 Teste 1: Diagnóstico Puppeteer"
node test-puppeteer-deps.js

echo -e "\n🐳 Teste 2a: Docker sem dependências"
docker build -t fila-whatsapp-no-deps -f Dockerfile.test-without-chromium . 2>&1 | tail -3
timeout 5 docker run --rm fila-whatsapp-no-deps 2>&1 | head -20 || true

echo -e "\n🐳 Teste 2b: Docker com dependências"
docker build -t fila-whatsapp-with-deps -f Dockerfile.test-with-chromium . 2>&1 | tail -3
docker run -d --name fila-test -p 3003:3003 fila-whatsapp-with-deps
sleep 3
echo "Testando /ping..."
curl -s http://localhost:3003/ping || echo "✗ Falhou"
docker stop fila-test && docker rm fila-test

echo -e "\n✅ Testes concluídos!"
```

---

**Estes testes não modificam o código e validam a hipótese antes de implementar solução.**
