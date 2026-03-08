# 🎯 Sistema de Fila Digital - Barbearia Gilmar

## 📋 Resumo Executivo

Sistema simples, estável e pronto para produção MVP para gerenciamento de filas em barbearias.

**Fluxo MVP:**
1. Cliente entra → 2. Espera → 3. Barbeiro chama → 4. Atende → 5. Próximo

Nada além disso.

---

## 🚀 Quick Start

### Instalação Backend

```bash
cd backend
npm install
```

### Configuração Database

```bash
# MySQL deve estar rodando
mysql -u root -p8880 fila
```

Aplicar migrations:
```bash
mysql -h localhost -u root -p8880 fila < database/migrations/002_add_queue_token.sql
mysql -h localhost -u root -p8880 fila < database/seed_demo_gilmar.sql
```

### Instalação Frontend

```bash
npm install
```

### Executar Sistema

**Terminal 1 - Backend:**
```bash
cd backend
node server.js
# Deve mostrar: ✓ Database connected successfully
# Port: 3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Acesso: http://localhost:5173
```

---

## 📊 Testes de Demonstração

### Cenário Realista com 8 Barbeiros e 20+ Clientes

**Dados Já Pré-carregados:**
- Barbearia: "Barbearia Gilmar"
- 8 Barbeiros: Carlos, Felipe, Rodrigo, André, Marcelo, Diego, Lucas, Rafael
- 8 Clientes Demo: João, Ana, Bruno, Débora, Eduardo, Fernanda, Gustavo, Helena
- Status simulados: finished, serving, called, waiting

---

## 🎮 Três Cenários de Teste

### 1️⃣ **Abas Simultâneas (Simular Fila Real)**

Abra 4 abas no navegador:

**ABA 1 - Cliente 1**
```
http://localhost:5173/client-queue
├─ Clique: "Entrar na fila geral"
├─ Nome: "Ze das Couves"
└─ Veja sua posição atualizar em tempo real
```

**ABA 2 - Cliente 2**
```
http://localhost:5173/client-queue
├─ Clique: "Entrar na fila geral"
├─ Nome: "Maria do Bairro"
└─ Veja a posição dele descer conforme clientes são atendidos
```

**ABA 3 - Barbeiro Dashboard**
```
http://localhost:5173/barbeiro
├─ Selecione "Barbeiro 1"
├─ Clique "Iniciar" para começar atender
├─ Clique "Finalizar" quando terminar
└─ Próximo cliente é automaticamente chamado
```

**ABA 4 - Monitor TV (Barbearia)**
```
http://localhost:5173/monitor
├─ Mostra em grande: "CHAMANDO AGORA: Ze das Couves"
├─ Próximos 3 na fila: 1, 2, 3
└─ Atualiza em tempo real (a cada 2 segundos)
```

---

### 2️⃣ **Seqüência de Atendimento**

1. **Cliente vê**: "Sua posição: 5 | À sua frente: 4 | Tempo estimado: 80 min"
2. **Monitor mostra**: "CHAMANDO AGORA: João → Carlos"
3. **Barbeiro inicia**: Cliente começando a ser atendido
4. **Cliente avança**: Posição muda para 4
5. **15 min depois**: Barbeiro clica "Finalizar"
6. **Próximo é chamado**: Automático

---

### 3️⃣ **Live Demo Flow (O que Impressiona)**

**1. Preparo (2 minutos antes)**
```
Terminal 1: npm run dev (frontend)
Terminal 2: node backend/server.js (backend)
```

**2. Abra 4 abas lado a lado**
```
├─ Cliente 1 (posição 3)
├─ Cliente 2 (posição 4)  
├─ Barbeiro Dashboard (Carlos)
└─ Monitor TV (full screen no projetor)
```

**3. Sequência (30 segundos)**
```
(1) [Barbeiro] Clica "Iniciar" 
    └─ Monitor mostra: "CHAMANDO AGORA: João → Carlos"
    └─ Cliente 1 vê: "Sua vez está chegando! Prepare-se!"

(2) [Barbeiro] Espera 15 segundos, clica "Finalizar"
    └─ Monitor: Novo cliente chamado
    └─ Cliente 1: Sai da fila, Cliente 2 sobe para posição 3

(3) Repete 3x para show completo
```

**O que eles veem:**
- ✅ Fila em tempo real
- ✅ Cliente sendo chamado (nome grande no monitor)
- ✅ Posição atualizando automaticamente
- ✅ Sistema é simples e funciona

---

## 🔧 Arquitetura MVP

### Backend (Node.js + Express)

```
/backend
├── server.js              # Express app
├── src/
│   ├── models/Queue.js    # Token generation, recovery
│   ├── services/          # Lógica de negócio
│   ├── controllers/       # HTTP handlers
│   ├── routes/            # Endpoints
│   └── middleware/        # Auth, validation
├── database/
│   ├── schema.sql         # Tabelas
│   ├── seed_demo_gilmar.sql
│   └── migrations/
│       └── 002_add_queue_token.sql
└── .env                   # Config
```

### Frontend (React + TypeScript)

```
/src
├── pages/
│   ├── client-queue.tsx   # Cliente vê fila
│   ├── monitor.tsx        # TV da barbearia
│   ├── barber.tsx         # Dashboard barbeiro
│   └── landing.tsx        # Home
├── hooks/
│   ├── useQueue.ts        # Gerenciar fila
│   └── useQueueWithToken.ts # Persistência
├── services/
│   ├── api.ts             # HTTP client
│   ├── queueService.ts    # Queue endpoints
│   └── tokenService.ts    # localStorage
└── components/ui/         # Componentes reutilizáveis
```

---

## 📱 Endpoints da API

### Queue (Fila)

```
POST   /api/queue/join                    # Entrar na fila
GET    /api/queue/:barbershopId           # Ver fila
GET    /api/queue/recover?token=xxx       # Recuperar por token
POST   /api/queue/call-next               # Chamar próximo
POST   /api/queue/finish                  # Finalizar cliente
POST   /api/queue/remove                  # Remover cliente
GET    /api/queue/monitor/:barbershopId   # Estado para TV
```

---

## 🎯 Casos de Uso Principais

### ✅ Cliente: Entrar na Fila

1. Abre `http://localhost:5173/client-queue`
2. Digita nome: "João Silva"
3. Clica "Entrar na fila geral"
4. **Sistema retorna:**
   - `queue_token` (para persistência)
   - Posição na fila
   - Time estimado
5. Salva `token` em `localStorage`
6. Se página refresh: **recupera automaticamente** pelo token

### ✅ Barbeiro: Gerenciar Atendimentos

1. Abre `http://localhost:5173/barbeiro`
2. Seleciona barbeiro (1-8)
3. Vê próximo cliente
4. Clica "Iniciar" → começa contagem de tempo
5. Clica "Finalizar" → próximo é chamado automaticamente
6. Monitor TV atualiza em tempo real

### ✅ Monitor TV: Mostrar Fila

1. Abre `http://localhost:5173/monitor` no projetor
2. Mostra em BIG:
   - "CHAMANDO AGORA: João → Carlos" (verde pulsante)
   - **OU** "CHAMADO: João" (amarelo)
   - **OU** "Fila vazia" (azul)
3. Próximos 3 embaixo
4. Atualiza a cada 2 segundos

---

## 🔑 Dados de Teste

### Usuário Dono
```
Email: gilmar@barbeariagilmar.com
Senha: 123456
Role: owner
```

### 8 Barbeiros Pré-carregados
```
1. Carlos Eduardo Souza
2. Felipe Almeida Santos
3. Rodrigo Pereira Lima
4. André Luiz Costa
5. Marcelo Henrique Dias
6. Diego Fernandes Rocha
7. Lucas Gabriel Martins
8. Rafael Batista Oliveira
```

### Clientes Demo na Fila
```
Status: finished (2)
Status: serving   (1)
Status: called    (1)
Status: waiting   (4)
```

---

## ⚙️ Configuração

### Backend (.env)
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=8880
DB_NAME=fila
JWT_SECRET=your_jwt_secret
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### Frontend (config/api.ts)
```
API_URL=http://localhost:3001/api
DEFAULT_BARBERSHOP_ID=1
```

---

## 🚨 Troubleshooting

### Erro: "Error: listen EADDRINUSE: address already in use :::3001"

```bash
# Matar processo na porta 3001
kill -9 $(lsof -t -i :3001)
```

### Erro: "Access denied for user 'root'@'localhost'"

```bash
# Verificar senha MySQL
mysql -h localhost -u root -p8880 -e "SELECT 1"
```

### Clientes não aparecem na fila

```bash
# Verificar dados no banco
mysql -h localhost -u root -p8880 fila -e "SELECT COUNT(*) FROM queue;"
```

---

## 📈 Escalabilidade Futura

Sem sair do MVP, já suportamos:

- ✅ Multiple barbershops (via `barbershop_id`)
- ✅ Token persistence (recuperação de página)
- ✅ Transaction locks (MySQL `FOR UPDATE`)
- ✅ Real-time updates (polling 2-5s)
- ✅ Status enum extensível (waiting, called, serving, finished, cancelled, no_show)
- ✅ Connection pooling (MySQL2)

---

## 🎓 Aprendizados Principais

1. **Simplicidade é força**: MVP tem 3 telas, 1 fluxo, 0 confusão
2. **Tokens para persistência**: Clientes recuperam posição após refresh
3. **Transações + locks**: Evitam race conditions quando 2 barbeiros chamam next()
4. **Polling > WebSocket**: Para MVP, 5s de polling é suficiente
5. **Backend stateless**: Cada request é independente, sem estado em memória

---

## ✨ Features Implementadas

- [x] Backend MVC com MySQL
- [x] Fila em tempo real
- [x] Token persistence (localStorage)
- [x] Monitor TV de barbearia
- [x] Dashboard barbeiro
- [x] Mini-games enquanto espera (Snake)
- [x] Seed de dados realistas
- [x] Branding Barbearia Gilmar
- [x] QR Code na entrada
- [x] Transações + row locks
- [x] Status expandido (no_show, cancelled)
- [x] Input validation
- [x] Error handling

---

## 🎬 Roteiro da Apresentação (5 minutos)

```
[0:00] Abrir http://localhost:5173
       └─ "Bem-vindo à Barbearia Gilmar"

[0:10] Entrar na fila como "Ze das Couves"
       └─ "Você está na posição 5, tempo estimado 80 minutos"

[0:30] Abrir Aba 2: outro cliente "Maria"
       └─ Monitor TV mostrando ambos

[0:45] Abrir Barbeiro Dashboard
       └─ "Próximo: Ze das Couves"
       └─ Clica "Iniciar"

[1:00] Monitor mostra: "CHAMANDO AGORA: Ze → Carlos"
       └─ Cliente 1 vê piscando "Prepare-se!"
       └─ Cliente 2 sobe para posição 4

[1:30] Barbeiro clica "Finalizar"
       └─ Próximo é chamado automaticamente

[2:00] Repetir 2x mais para impressionar

[5:00] "Pronto para produção! Basta trocar os dados de cliente."
```

---

## 📞 Suporte

**Contato para dúvidas:**
- Email: suporte@barbeariagilmar.com
- WhatsApp: ...

---

**Versão:** 1.0.0 MVP  
**Data:** Março 2026  
**Status:** ✅ Pronto para Produção
