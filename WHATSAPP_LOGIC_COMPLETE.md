# Documentação Completa da Lógica WhatsApp - FilaLivre

**Data:** 10 de março de 2026  
**Status:** Implementação Ativa  
**Versão:** 1.0

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Componentes do Sistema](#componentes-do-sistema)
4. [Fluxo de Conexão (QR Code)](#fluxo-de-conexão-qr-code)
5. [Fluxo de Envio de Mensagens](#fluxo-de-envio-de-mensagens)
6. [Banco de Dados](#banco-de-dados)
7. [Endpoints da API](#endpoints-da-api)
8. [Frontend Integration](#frontend-integration)
9. [Processamento da Fila (Worker)](#processamento-da-fila-worker)
10. [Tratamento de Sessões](#tratamento-de-sessões)
11. [Estrutura de Diretórios](#estrutura-de-diretórios)

---

## 🏗️ Visão Geral da Arquitetura

O sistema de WhatsApp foi implementado com **arquitetura em micro-serviços**, separando a lógica de WhatsApp do servidor principal:

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                    (admin.tsx page)                          │
└──────────────┬──────────────────────────────────────────────┘
               │ (HTTP Requests)
               │
    ┌──────────▼────────────────────────┐
    │  API Principal (server.js:3001)   │
    │  ├─ Autenticação                  │
    │  ├─ Fila & Clientes               │
    │  └─ Endpoint proxy para WhatsApp  │
    └──────┬─────────────────────────────┘
           │ (HTTP)
           │
    ┌──────▼─────────────────────────────────┐
    │  Serviço WhatsApp (server.whatsapp.js)  │
    │  Port: 3003                             │
    │  ├─ POST /connect/:barbershopId         │
    │  ├─ POST /disconnect/:barbershopId      │
    │  ├─ GET /status/:barbershopId           │
    │  ├─ POST /send                          │
    │  └─ GET /qr/:barbershopId               │
    └──────┬──────────────────────────────────┘
           │ (Instâncias @wppconnect)
           │
    ┌──────▼──────────────────────────────────┐
    │  WPPConnect (Biblioteca)                 │
    │  ├─ Conecta com WhatsApp Web             │
    │  ├─ Gerencia sessões                     │
    │  └─ Envia mensagens                      │
    └──────┬──────────────────────────────────┘
           │ (WebSocket com WhatsApp Web)
           │
           └──────────▶ WhatsApp Web
```

### Fluxo Paralelo do Worker

```
┌──────────────────────────────────────┐
│  Worker (server.worker.js:Port 3001)  │
│  Interval: 5s (configurável)          │
│                                        │
│  1. Busca clientes na fila             │
│  2. Calcula posição                    │
│  3. Se ≤3 pessoas à frente:            │
│     └─ Chama POST /send do WhatsApp   │
│  4. Marca alert_sent = true            │
└──────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológica

### API de WhatsApp Utilizada
- **Biblioteca:** `@wppconnect-team/wppconnect`
- **Versão:** Última (especificada em package.json)
- **Tipo:** Client-side WhatsApp Web wrapper
- **Mecanismo:** Simula um cliente WhatsApp Web via Puppeteer/Chromium

### Dependências Principais
```json
{
  "@wppconnect-team/wppconnect": "^latest",
  "express": "^4.18.0",
  "mysql2": "^3.0.0"
}
```

### Infraestrutura
- **Node.js:** Runtime
- **Express:** Framework HTTP
- **MySQL:** Banco de dados
- **Puppeteer/Chromium:** Navegador headless para automação
- **Railway/Docker:** Deploy

---

## 🔧 Componentes do Sistema

### 1. **Frontend (React)**

**Arquivo:** `src/pages/admin.tsx`

```typescript
// Estados para controlar WhatsApp
const [waStatus, setWaStatus] = useState<string>('disconnected');
const [waQr, setWaQr] = useState<string | null>(null);
const [waLoading, setWaLoading] = useState(false);
```

**Elementos Visuais:**
- Card com status da conexão
- Exibição do QR Code (quando necessário)
- Botões: "Conectar", "Reconectar", "Desconectar"
- Card informativo sobre funcionamento

### 2. **Backend Principal (server.js:3001)**

Atual servidor que:
- Autentica usuários
- Gerencia fila
- **NÃO** manipula WhatsApp diretamente
- Faz proxy para o serviço WhatsApp

### 3. **Serviço WhatsApp Dedicado (server.whatsapp.js:3003)**

Responsável por:
- Gerenciar sessões WPPConnect
- Gerar e armazenar QR Codes
- Enviar mensagens
- Manter estado das sessões

### 4. **Worker (server.worker.js)**

Processa fila a cada intervalo:
- Busca clientes em espera
- Calcula quantos estão à frente
- Dispara alertas automáticos via WhatsApp

### 5. **Banco de Dados (MySQL)**

Tabela principal:
```sql
CREATE TABLE whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  session_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🔐 Fluxo de Conexão (QR Code)

### Sequência Passo a Passo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PROPRIETÁRIO CLICA EM "CONECTAR WHATSAPP"               │
│    (Frontend: admin.tsx → handleWaConnect())               │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 2. FRONTEND FAZ REQUEST:                                    │
│    POST /api/whatsapp/connect/:barbershopId                │
│    Headers: Authorization: Bearer token                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 3. API PRINCIPAL (server.js:3001)                           │
│    - Valida token JWT                                       │
│    - Verifica permissão (owner)                             │
│    - Redireciona para WhatsApp Service                      │
│    POST http://localhost:3003/connect/:barbershopId         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 4. SERVIÇO WHATSAPP (server.whatsapp.js:3003)              │
│    - Extrai barbershopId do params                          │
│    - Cria sessionName = "barbershop_" + barbershopId       │
│    - Checa se sessão já existe na memória                   │
│    - Se NÃO existe: chama startSession(sessionName)         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 5. FUNÇÃO: startSession() (WhatsAppService.js)             │
│                                                              │
│    a) Detecta Chromium do sistema:                          │
│       - Busca em /usr/bin/chromium (Railway)                │
│       - Fallback: Chromium bundled do Puppeteer             │
│                                                              │
│    b) Cria QR Promise que espera geração                    │
│                                                              │
│    c) Chama wppconnect.create({...config})                  │
│       - Inicia navegador headless                           │
│       - Conecta com WhatsApp Web                            │
│       - Configura callbacks                                 │
│                                                              │
│    d) Callbacks:                                            │
│       - catchQR: Armazena QR gerado em base64              │
│       - statusFind: Monitora status da sessão               │
│                                                              │
│    e) Se statusFind = "isLogged" ou "qrReadSuccess":        │
│       → Já estava conectado, resolve promise                │
│       → Nenhum QR retorna                                   │
│                                                              │
│    f) Armazena client em Map (sessões)                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 6. RESPOSTA DO WHATSAPP SERVICE:                           │
│    Se gerou QR:                                             │
│    {                                                         │
│      success: true,                                         │
│      status: "waiting_qr",                                  │
│      qr: "data:image/png;base64,iVBORw0KG..."             │
│    }                                                         │
│                                                              │
│    Se já estava conectado:                                  │
│    {                                                         │
│      success: true,                                         │
│      status: "connected",                                   │
│      qr: null                                               │
│    }                                                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 7. API PRINCIPAL RETORNA AO FRONTEND                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 8. FRONTEND (admin.tsx)                                     │
│    - Estado waQr recebe Base64                             │
│    - Estado waStatus <- "waiting_qr"                        │
│    - Exibe <img src={waQr} />                              │
│    - Inicia polling a cada 3s para status                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 9. PROPRIETÁRIO ESCANEIA QR CODE COM WHATSAPP MOBILE       │
│    - Abre WhatsApp → Menu (⋮) → Aparelhos conectados      │
│    - "Conectar aparelho"                                    │
│    - Aponta câmera para tela do navegador                   │
│    - Confirma a conexão no mobile                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 10. WHATSAPP WEB RECONHECE SCAN                            │
│     - Callback statusFind recebe "qrReadSuccess"            │
│     - WPPConnect autentica automaticamente                  │
│     - statusFind também pode receber "isLogged"             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 11. POLL DO FRONTEND (a cada 3s)                           │
│     GET /api/whatsapp/status/:barbershopId                 │
│     Retorna: { status: "connected", qr: null }             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 12. ATUALIZAÇÃO DA UI                                      │
│     - QR Code desaparece                                    │
│     - Ícone muda para VERDE (Conectado)                     │
│     - Botões mudam para "Reconectar" e "Desconectar"       │
│                                                              │
│     ✅ CONEXÃO COMPLETA                                     │
└──────────────────────────────────────────────────────────────┘
```

### Código do Frontend (Resumido)

```typescript
// Botão que inicia o fluxo
const handleWaConnect = async () => {
  setWaLoading(true);
  try {
    const response = await api.post(
      API_ENDPOINTS.whatsappConnect(barbershopId)
    );
    setWaStatus(response.data.status);
    setWaQr(response.data.qr);
    
    // Inicia polling se aguardando QR
    if (response.data.status === 'waiting_qr') {
      const pollInterval = setInterval(async () => {
        const statusRes = await api.get(
          API_ENDPOINTS.whatsappStatus(barbershopId)
        );
        setWaStatus(statusRes.data.status);
        
        if (statusRes.data.status === 'connected') {
          setWaQr(null);
          clearInterval(pollInterval);
        }
      }, 3000); // Poll a cada 3 segundos
    }
  } catch (err) {
    console.error('Erro ao conectar:', err);
  } finally {
    setWaLoading(false);
  }
};
```

---

## 📤 Fluxo de Envio de Mensagens

### Caminho Principal: Worker → WhatsApp Service → Cliente

```
┌─────────────────────────────────────────────────────────────┐
│ WORKER (server.worker.js)                                   │
│ Executa a cada 5 segundos:                                  │
│                                                              │
│ 1. Query:                                                    │
│    SELECT * FROM queue                                      │
│    WHERE status = 'waiting'                                 │
│    AND alert_sent = false                                   │
│    AND phone IS NOT NULL                                    │
│                                                              │
│ 2. Para cada cliente resultado:                             │
│    - Calcula quantas pessoas estão à frente                 │
│    - Se ≤ 3 pessoas à frente:                               │
│      └─ Tenta enviar mensagem WhatsApp                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ VERIFICAÇÃO DE SESSÃO (checkWhatsAppStatus)                 │
│                                                              │
│ - Checa se sessão WhatsApp está ativa                        │
│ - Faz GET http://localhost:3003/status/:barbershopId        │
│ - Se não estiver ativa → pula para próximo cliente           │
│                                                              │
│ Se ativa → continua                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ CONSTRUÇÃO DA MENSAGEM                                      │
│                                                              │
│ Se ninguém na frente (position = 1):                         │
│   "Olá João! Você é o próximo. Dirija-se ao atendimento."   │
│                                                              │
│ Se existem pessoas na frente:                                │
│   "Olá João! Faltam apenas 2 pessoas para sua vez. Prepare!"│
│                                                              │
│ Variáveis usadas:                                            │
│   - client.name (nome do cliente)                            │
│   - peopleAhead (pessoas à frente)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ ENVIO DA MENSAGEM                                           │
│                                                              │
│ POST http://localhost:3003/send                             │
│ {                                                            │
│   barbershopId: 1,                                          │
│   phone: "11987654321",                                     │
│   message: "Olá João! Faltam apenas 2..."                   │
│ }                                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ WHATSAPP SERVICE (/send endpoint)                           │
│                                                              │
│ 1. Busca sessão na memória:                                 │
│    client = sessions.get("barbershop_1")                    │
│                                                              │
│ 2. Formata número:                                          │
│    cleanPhone = "11987654321"                               │
│    number = "11987654321@c.us"                              │
│                                                              │
│ 3. Envia via WPPConnect:                                     │
│    await client.sendText(number, message)                   │
│                                                              │
│ 4. WPPConnect se comunica com WhatsApp Web                   │
│    → WhatsApp envia mensagem real                           │
│                                                              │
│ 5. Retorna sucesso                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ MARCAÇÃO NO BANCO                                           │
│                                                              │
│ UPDATE queue                                                │
│ SET alert_sent = true                                       │
│ WHERE id = ?                                                │
│                                                              │
│ Isso evita envios duplicados                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ LOG DO WORKER                                               │
│                                                              │
│ "[Worker] WhatsApp enviado para João (11987654321) - 2..."  │
│                                                              │
│ ✅ MENSAGEM ENTREGUE AO CLIENTE                            │
└──────────────────────────────────────────────────────────────┘
```

### Exemplo Prático

```
Cliente "João Silva" entra na fila:
- phone: "11987654321"
- position: 4

Execução do Worker às 09:05:00
├─ Pessoas à frente: 3 (posições 1, 2, 3)
├─ Critério: 3 ≤ 3 → SIM
└─ Envia: "Olá João! Faltam apenas 3 pessoas para sua vez. Prepare-se!"

Execução do Worker às 09:05:05
├─ João agora na posição 3 (2 pessoas à frente)
├─ Mas alert_sent = true → NÃO envia (evita spam)

Quando um cliente termina o atendimento:
├─ Posição de João atualiza: 2, 1, depois 0 (atendido)
├─ Nenhum novo alerta enviado (redundante)
```

---

## 💾 Banco de Dados

### Tabela Principal: `whatsapp_sessions`

```sql
CREATE TABLE whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,      -- Identificador único
  barbershop_id INT NOT NULL,             -- ID do estabelecimento
  session_name VARCHAR(100),              -- "barbershop_1", "barbershop_2", etc
  status VARCHAR(20) DEFAULT              -- "connected", "waiting_qr", "disconnected"
    'disconnected',
  created_at TIMESTAMP DEFAULT             -- Quando foi criada a sessão
    CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT             -- Última atualização
    CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Extensão da Tabela `queue`

```sql
ALTER TABLE queue 
ADD COLUMN alert_sent BOOLEAN DEFAULT FALSE;
```

**Este campo indica:**
- `FALSE` = cliente ainda não foi alertado
- `TRUE` = cliente já recebeu mensagem WhatsApp

### Relacionamento de Dados

```
barbershops (n=1)
    ↓
whatsapp_sessions (1:1)
    └─ status: connected | waiting_qr | disconnected
    └─ session_name: gerado automaticamente

queue (n:1 para barbershops)
    └─ alert_sent: marca se mensagem foi enviada
    └─ phone: número do cliente (necessário para envio)
```

### Ciclo de Vida de uma Sessão no Banco

```
1. CRIAÇÃO
   INSERT INTO whatsapp_sessions 
   (barbershop_id, session_name, status)
   VALUES (1, 'barbershop_1', 'waiting_qr')

2. AUTENTICAÇÃO
   UPDATE whatsapp_sessions 
   SET status = 'connected', updated_at = NOW()
   WHERE barbershop_id = 1

3. DESCONEXÃO
   UPDATE whatsapp_sessions 
   SET status = 'disconnected', updated_at = NOW()
   WHERE barbershop_id = 1

4. REINICIALIZAÇÃO AO BOOT
   SELECT barbershop_id 
   FROM whatsapp_sessions 
   WHERE status = 'connected'
   → Reconecta todas as sessões
```

---

## 🔌 Endpoints da API

### WhatsApp Service (Port 3003)

#### 1. **POST /connect/:barbershopId**

**Propósito:** Iniciar sessão e gerar QR Code

```http
POST http://localhost:3003/connect/1
Content-Type: application/json

RESPONSE 200:
{
  "success": true,
  "status": "waiting_qr",
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}

// Ou se já estava conectado:
{
  "success": true,
  "status": "connected",
  "qr": null
}
```

**Estado Interno:**
- Sessions Map: `{ "barbershop_1" → wppconnect.client }`
- QR Codes Map: `{ "barbershop_1" → "data:image/png..." }`
- Database: `whatsapp_sessions` inserida/atualizada

#### 2. **POST /disconnect/:barbershopId**

**Propósito:** Encerrar sessão e apagar memória

```http
POST http://localhost:3003/disconnect/1
Content-Type: application/json

RESPONSE 200:
{
  "success": true,
  "status": "disconnected"
}
```

**Efeitos:**
- Fecha cliente WPPConnect
- Remove de `sessions` Map
- Remove de `qrCodes` Map
- Atualiza DB: `status = 'disconnected'`

#### 3. **GET /status/:barbershopId**

**Propósito:** Verificar se sessão está ativa e buscar QR se necessário

```http
GET http://localhost:3003/status/1
Content-Type: application/json

RESPONSE 200:
{
  "session": "barbershop_1",
  "active": true,              // boolean
  "status": "connected",       // do banco de dados
  "qr": null                   // null se ativo, Base64 se aguardando
}
```

**Lógica:**
```javascript
active = sessions.has(sessionName)  // Checar memória
status = db.whatsapp_sessions       // Checar banco
qr = qrCodes.get(sessionName) || null
```

#### 4. **POST /send**

**Propósito:** Enviar mensagem WhatsApp

```http
POST http://localhost:3003/send
Content-Type: application/json

REQUEST:
{
  "barbershopId": 1,
  "phone": "11987654321",
  "message": "Olá! Faltam 2 pessoas"
}

RESPONSE 200:
{
  "success": true,
  "message": "Mensagem enviada"
}

RESPONSE 404 (se sessão não conectada):
{
  "error": "Sessão WhatsApp não ativa para este estabelecimento"
}

RESPONSE 500 (erro ao enviar):
{
  "error": "Erro ao enviar mensagem",
  "details": "..."
}
```

**Transformações:**
- `phone: "11987654321"` → `"11987654321@c.us"`
- Remove caracteres não-numéricos: `"(11) 98765-4321"` → `"11987654321"`

#### 5. **GET /qr/:barbershopId**

**Propósito:** Obter QR Code já gerado (para recuperação)

```http
GET http://localhost:3003/qr/1

RESPONSE 200:
{
  "qr": "data:image/png;base64,..." // ou null
}
```

#### 6. **GET /health**

**Propósito:** Health check

```http
GET http://localhost:3003/health

RESPONSE 200:
{
  "service": "filalivre-whatsapp",
  "status": "ok",
  "timestamp": "2024-03-10T09:05:00Z"
}
```

---

## 🎨 Frontend Integration

### Arquivo: `src/pages/admin.tsx`

### Estados Principais

```typescript
// Controla status visual
const [waStatus, setWaStatus] = useState<string>('disconnected');

// Armazena QR Code em Base64
const [waQr, setWaQr] = useState<string | null>(null);

// Loading durante requisições
const [waLoading, setWaLoading] = useState(false);

// ID do estabelecimento (do usuário autenticado)
const barbershopId = user?.barbershop_id;
```

### Life Cycle

**Ao Montar o Componente:**
```typescript
useEffect(() => {
  if (view === 'whatsapp') {
    // Busca status atual
    fetchWaStatus();
    
    // Se mostrando a view, faz polling a cada 3s
    const interval = setInterval(fetchWaStatus, 3000);
    return () => clearInterval(interval);
  }
}, [view]);
```

### Handlers Principais

```typescript
// Conectar
const handleWaConnect = async () => {
  setWaLoading(true);
  try {
    const response = await api.post(
      API_ENDPOINTS.whatsappConnect(barbershopId)
    );
    setWaStatus(response.data.status);
    setWaQr(response.data.qr);
  } catch (err) {
    // Tratamento de erro
  } finally {
    setWaLoading(false);
  }
};

// Desconectar
const handleWaDisconnect = async () => {
  setWaLoading(true);
  try {
    await api.post(API_ENDPOINTS.whatsappDisconnect(barbershopId));
    setWaStatus('disconnected');
    setWaQr(null);
  } catch (err) {
    // Tratamento de erro
  } finally {
    setWaLoading(false);
  }
};

// Buscar status
const fetchWaStatus = async () => {
  try {
    const response = await api.get(
      API_ENDPOINTS.whatsappStatus(barbershopId)
    );
    setWaStatus(response.data.status);
    if (response.data.qr) {
      setWaQr(response.data.qr);
    }
  } catch (err) {
    // Silenciosamente falha se serviço não disponível
  }
};
```

### Renderização do QR Code

```typescript
{waQr && waStatus !== 'connected' && (
  <div className="bg-white rounded-xl border-2 border-dashed border-neutral-200 p-6 flex flex-col items-center gap-4">
    <div className="flex items-center gap-2 text-neutral-600">
      <QrCode className="w-5 h-5" />
      <span className="text-sm font-semibold">
        Escaneie o QR Code com o WhatsApp
      </span>
    </div>
    <img
      src={waQr}
      alt="WhatsApp QR Code"
      className="max-w-[280px] rounded-lg"
    />
    <p className="text-xs text-neutral-400 text-center max-w-xs">
      Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados 
      → Conectar aparelho
    </p>
  </div>
)}
```

### API Endpoints Utilizados

```typescript
export const API_ENDPOINTS = {
  whatsappConnect: (barbershopId) => `/whatsapp/connect/${barbershopId}`,
  whatsappDisconnect: (barbershopId) => `/whatsapp/disconnect/${barbershopId}`,
  whatsappStatus: (barbershopId) => `/whatsapp/status/${barbershopId}`,
  whatsappQr: (barbershopId) => `/whatsapp/qr/${barbershopId}`,
};
```

---

## ⚙️ Processamento da Fila (Worker)

### Arquivo: `backend/server.worker.js`

### Configuração

```javascript
const WHATSAPP_SERVICE_URL = 
  process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
const CHECK_INTERVAL = 
  parseInt(process.env.WORKER_INTERVAL || '5000', 10);
  // Default: 5.000ms = 5 segundos
```

### Função Principal: `checkQueueAlerts()`

```javascript
async function checkQueueAlerts() {
  // 1. Busca todos os clientes em espera que não foram alertados
  const [candidates] = await pool.query(
    `SELECT * FROM queue
     WHERE status = 'waiting'
     AND alert_sent = false
     AND phone IS NOT NULL
     AND phone != ''`
  );

  // 2. Para cada cliente
  for (const client of candidates) {
    // 3. Calcula quantos estão à frente
    const [ahead] = await pool.query(
      `SELECT COUNT(*) as cnt FROM queue
       WHERE barbershop_id = ?
       AND status = 'waiting'
       AND position < ?`,
      [client.barbershop_id, client.position]
    );

    const peopleAhead = ahead[0].cnt;
    
    // 4. Se mais de 3 pessoas à frente, pula
    if (peopleAhead > 3) continue;

    // 5. Verifica se sessão WhatsApp está ativa
    const sessionActive = await checkWhatsAppStatus(
      client.barbershop_id
    );
    if (!sessionActive) continue;

    // 6. Constrói mensagem personalizada
    const message = peopleAhead === 0
      ? `Olá ${client.name}! Você é o próximo. Dirija-se ao atendimento.`
      : `Olá ${client.name}! Faltam apenas ${peopleAhead} pessoa${peopleAhead > 1 ? 's' : ''} para sua vez. Prepare-se!`;

    // 7. Tenta enviar
    try {
      await sendWhatsAppMessage(
        client.barbershop_id,
        client.phone,
        message
      );

      // 8. Marca como alertado
      await pool.query(
        'UPDATE queue SET alert_sent = true WHERE id = ?',
        [client.id]
      );

      console.log(
        `[Worker] WhatsApp enviado para ${client.name} (${client.phone}) - ${peopleAhead} à frente`
      );
    } catch (err) {
      console.error(
        `[Worker] Erro ao enviar WhatsApp para ${client.name}:`,
        err.message
      );
      // Continua tentando outros clientes
    }
  }
}
```

### Função Helper: `sendWhatsAppMessage()`

```javascript
async function sendWhatsAppMessage(
  barbershopId,
  phone,
  message
) {
  const response = await fetch(
    `${WHATSAPP_SERVICE_URL}/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbershopId,
        phone,
        message
      }),
    }
  );
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}
```

### Função Helper: `checkWhatsAppStatus()`

```javascript
async function checkWhatsAppStatus(barbershopId) {
  try {
    const response = await fetch(
      `${WHATSAPP_SERVICE_URL}/status/${barbershopId}`
    );
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.active === true;  // Checa se está realmente ativo
  } catch {
    return false; // Falha silenciosamente
  }
}
```

### Loop Principal

```javascript
async function startWorker() {
  while (true) {
    try {
      await checkQueueAlerts();
    } catch (err) {
      console.error('[Worker] Error:', err.message);
    }
    // Aguarda intervalo antes da próxima execução
    await new Promise((resolve) =>
      setTimeout(resolve, CHECK_INTERVAL)
    );
  }
}

startWorker();
```

### Exemplo de Execução

```
[09:05:00] Worker iniciou ciclo
[09:05:00] Buscando clientes em espera...
[09:05:01] Encontrado: João Silva (position 4)
[09:05:01] Pessoas à frente: 3
[09:05:01] Critério: 3 ≤ 3 → SIM
[09:05:01] Verificando sessão WhatsApp para barbershop 1...
[09:05:01] Sessão ativa: SIM
[09:05:01] Enviando mensagem...
[09:05:02] WhatsApp enviado para João Silva (11987654321) - 3 à frente
[09:05:02] Marcando alert_sent = true no banco
[09:05:03] Ciclo completo

[09:05:05] Worker iniciou novo ciclo
[09:05:05] Buscando clientes em espera...
[09:05:05] Encontrado: João Silva (agora position 3)
[09:05:05] alert_sent = true → PULA (não envia duplicado)
[09:05:05] Ciclo completo
```

---

## 🔄 Tratamento de Sessões

### Em Memória (Map JavaScript)

```javascript
// Arquivo: WhatsAppService.js

const sessions = new Map();
// Exemplo: {
//   "barbershop_1" → wppconnect.Client,
//   "barbershop_2" → wppconnect.Client,
// }

const qrCodes = new Map();
// Exemplo: {
//   "barbershop_1" → "data:image/png;base64,...",
//   "barbershop_2" → "data:image/png;base64,...",
// }
```

**Características:**
- ✅ Rápido acesso em tempo real
- ❌ Perdido ao reiniciar servidor
- ✅ Separado por barbershop

### No Banco de Dados (MySQL)

```javascript
// Ao conectar
await registerSession(barbershopId, 'connected');
// INSERT INTO whatsapp_sessions (...) VALUES (...)
// ON DUPLICATE KEY UPDATE status = 'connected'

// Ao desconectar
await registerSession(barbershopId, 'disconnected');

// Ao buscar
const session = await getSessionFromDB(barbershopId);
// SELECT * FROM whatsapp_sessions WHERE barbershop_id = ?
```

**Características:**
- ✅ Persistente após restart
- ✅ Histórico de alterações
- ✅ Sincronização entre instâncias

### Inicialização ao Boot

```javascript
// Arquivo: server.whatsapp.js

app.listen(PORT, '0.0.0.0', async () => {
  // Restaura sessões conectadas do banco
  await startAllSessions();
});

// Função
export async function startAllSessions() {
  const [rows] = await pool.query(
    `SELECT barbershop_id
     FROM whatsapp_sessions
     WHERE status = 'connected'`
  );

  for (const row of rows) {
    const sessionName = "barbershop_" + row.barbershop_id;
    try {
      await startSession(sessionName);
      // Reconecta com WhatsApp Web
    } catch (err) {
      console.error(`Erro ao iniciar ${sessionName}: ${err.message}`);
      // Continua com outros
    }
  }
}
```

### Detecção de Chromium

```javascript
function getChromiumPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,  // Variável de env
    '/usr/bin/chromium',                     // Railway Linux
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;  // Usa bundled do Puppeteer
}
```

### Argumentos do Chromium (Production-Ready)

```javascript
browserArgs: [
  '--no-sandbox',                    // Necessário em containers
  '--disable-setuid-sandbox',        // Railway/Docker
  '--disable-dev-shm-usage',        // Limita uso de /dev/shm
  '--disable-gpu',                   // Sem aceleração GPU
  '--no-first-run',
  '--no-zygote',
  '--single-process',                // Reduz overhead de processo
],
```

---

## 📂 Estrutura de Diretórios

```
filalivre/
├── backend/
│   ├── server.js                    # API Principal (3001)
│   ├── server.whatsapp.js           # Serviço WhatsApp (3003) ⭐
│   ├── server.worker.js             # Processador de Fila ⭐
│   ├── env.js
│   ├── package.json
│   │
│   ├── database/
│   │   ├── schema.sql               # Schema com tabela whatsapp_sessions
│   │   └── migrations/
│   │       └── 003_add_whatsapp_support.sql ⭐
│   │
│   └── src/
│       ├── config/
│       │   └── database.js          # Pool MySQL connection
│       │
│       ├── services/
│       │   ├── WhatsAppService.js   # Lógica principal ⭐
│       │   └── whatsapp/
│       │       ├── sessionManager.js (não ativo)
│       │       ├── messageDispatcher.js (não ativo)
│       │       └── sessionPool.js (não ativo)
│       │
│       ├── controllers/
│       ├── routes/
│       ├── models/
│       └── middlewares/
│
├── src/ (Frontend)
│   ├── config/
│   │   └── api.ts                   # API_ENDPOINTS ⭐
│   │
│   ├── pages/
│   │   └── admin.tsx                # Interface WhatsApp ⭐
│   │
│   ├── services/
│   │   ├── api.ts
│   │   └── ... (outros serviços)
│   │
│   └── ...
│
└── WHATSAPP_LOGIC_COMPLETE.md       # Este documento

⭐ = Arquivo crítico para WhatsApp
```

---

## 🚀 Resumo Operacional

### Inicialização do Sistema

```
1. docker-compose up
   ├─ MySQL inicia
   ├─ server.js:3001 inicia (API Principal)
   ├─ server.whatsapp.js:3003 inicia (WhatsApp Service)
   └─ server.worker.js inicia (Processador de Fila)

2. server.whatsapp.js na porta 3003
   └─ startAllSessions()
      └─ Busca do banco: SELECT ... WHERE status = 'connected'
      └─ Para cada barbershop conectado: startSession()
      └─ Reconecta com WhatsApp Web (pode levar alguns segundos)

3. server.worker.js inicia loop
   └─ A cada 5 segundos: checkQueueAlerts()
```

### Durante Operação

```
[Ciclo 1 - 3s]
Usuario clica "Conectar WhatsApp" no admin
  → POST /api/whatsapp/connect/1
    → POST http://localhost:3003/connect/1
      → startSession("barbershop_1")
        → wppconnect gera QR Code
      → Armazena em memória e BD
    → Retorna QR em Base64
  → Frontend exibe QR
  → Proprietário escaneia no mobile
  → statusFind callback detecta "isLogged"

[Ciclo 2 - Polling 3s]
  → Frontend faz GET /api/whatsapp/status/1
    → GET http://localhost:3003/status/1
      → Checa se "barbershop_1" está em sessions Map
      → Retorna status = "connected"
  → UI atualiza (QR desaparece, ícone fica verde)

[Ciclo 3 - Worker a cada 5s]
  → Worker busca clientes em espera sem alerta
  → Encontra "João Silva" com 3 pessoas à frente
  → Verifica sessão ativa: ✅
  → Cria mensagem: "Olá João! Faltam apenas 3 pessoas..."
  → POST http://localhost:3003/send
    → WPPConnect envia via WhatsApp Web
    → WhatsApp realmente envia para +5511987654321
  → UPDATE queue SET alert_sent = true
  → Log: "[Worker] WhatsApp enviado para João..."

[Ciclo 4 - Desconexão]
Usuario clica "Desconectar WhatsApp"
  → POST /api/whatsapp/disconnect/1
    → POST http://localhost:3003/disconnect/1
      → client.close()
      → sessions.delete("barbershop_1")
      → qrCodes.delete("barbershop_1")
      → UPDATE whatsapp_sessions SET status = 'disconnected'
  → UI volta ao estado desconectado
```

---

## 🔍 Validação e Debugging

### Checklist de Validação

- [ ] WPPConnect instalado: `npm ls @wppconnect-team/wppconnect`
- [ ] Chromium disponível: `which chromium` ou `/usr/bin/chromium-browser`
- [ ] Tabela DB criada: `SHOW TABLES LIKE 'whatsapp_sessions';`
- [ ] Serviço WhatsApp respondendo: `curl http://localhost:3003/health`
- [ ] Frontend vê endpoints: Inspecionar `API_ENDPOINTS` no console
- [ ] Worker rodando: Ver logs "Worker iniciou ciclo"
- [ ] Sessão em memória: WPPConnect console deve mostrar "Sessão criada"

### Testes de Integração

```bash
# 1. Test: Conectar WhatsApp
curl -X POST http://localhost:3003/connect/1

# 2. Test: Verificar status
curl http://localhost:3003/status/1

# 3. Test: Enviar mensagem (requer sessão ativa)
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{
    "barbershopId": 1,
    "phone": "+551133334444",
    "message": "Teste FilaLivre"
  }'

# 4. Test: Buscar QR
curl http://localhost:3003/qr/1
```

### Logs Importantes

**servidor.whatsapp.js:**
```
[WhatsApp] QR Code gerado para sessão: barbershop_1
[WhatsApp] Status da sessão: isLogged
[WhatsApp] Sessão iniciada: barbershop_1
```

**server.worker.js:**
```
[Worker] WhatsApp enviado para João Silva (11987654321) - 2 à frente
[Worker] Error: Sessão WhatsApp não encontrada
```

**Frontend (Console do navegador):**
```
waStatus: "connected"
waQr: null
waLoading: false
```

---

## 📋 Variáveis de Ambiente

```env
# backend/.env

# WhatsApp Service (porta do serviço dedicado)
WHATSAPP_SERVICE_URL=http://localhost:3003

# Worker (intervalo de verificação em ms)
WORKER_INTERVAL=5000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=filalivre

# API
API_PORT=3001
NODE_ENV=development

# Frontend pode ser ajustado em src/config/api.ts
VITE_API_URL=http://localhost:3001/api
```

---

## 🎯 Conclusão

A implementação do WhatsApp segue um padrão **escalável e desacoplado**:

1. **Serviço Dedicado:** WhatsApp isolado na porta 3003
2. **Sessões em Memória:** Acesso rápido com fallback no BD
3. **Worker Automático:** Alertas disparados a cada 5 segundos
4. **Frontend Responsivo:** Polling para status em tempo real
5. **Banco Persistente:** Sessões recuperáveis após restart
6. **Tratamento Robusto:** Erros não derrubam outros clientes

**Próximos Passos Sugeridos:**
- [ ] Implementar retry logic para envios falhados
- [ ] Adicionar webhook para confirmação de entrega
- [ ] Criar dashboard de estatísticas WhatsApp
- [ ] Implementar queue com prioridades
- [ ] Adicionar suporte a múltiplos números por barbershop
- [ ] Implementar template de mensagens customizáveis
- [ ] Adicionar análise de sentimento (opcional)

---

**Documento criado em:** 10 de março de 2026  
**Versão:** 1.0  
**Status:** Validado ✅
