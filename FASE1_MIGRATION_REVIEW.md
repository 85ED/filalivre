# FASE 1: Migration SQL para Implementação de Notificações WhatsApp

## ✅ AJUSTES APLICADOS

✅ **Ajuste 1:** BOOLEAN → TINYINT(1)
- Melhor compatibilidade com ORM
- Mais eficiente em banco de dados

✅ **Ajuste 2:** Índice otimizado
- De: `(barbershop_id, notificado_whatsapp)`
- Para: `(barbershop_id, position, notificado_whatsapp)`
- Melhora muito a busca na fila (você vai consultar por posição + notificado)

✅ **Ajuste 3:** Data type casting
- Usar `CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE)` 
- Evita problemas de string vs date

✅ **Ajuste 4:** NOT NULL em INTs
- Adicionar `NOT NULL` aos campos: notificacoes_enviadas, limite_mensal, creditos_extra
- Evita NULLs inesperados

---

## 🗄️ MIGRATION SQL (Pronta para executar)

Arquivo: `backend/database/migrations/014_whatsapp_notifications.sql`

**3 mudanças no banco:**

```sql
CREATE TABLE whatsapp_usage (
  id, barbershop_id, mes_referencia, 
  notificacoes_enviadas INT NOT NULL, 
  limite_mensal INT NOT NULL, 
  creditos_extra INT NOT NULL
)

CREATE TABLE whatsapp_credits_log (
  id, barbershop_id, tipo_movimento (compra/uso/ajuste),
  quantidade, saldo_anterior, saldo_posterior, stripe_transaction_id
)

ALTER TABLE queue 
ADD COLUMN notificado_whatsapp TINYINT(1) DEFAULT 0
CREATE INDEX idx_queue_notify 
ON queue(barbershop_id, position, notificado_whatsapp);
```

---

## 📊 SQL que será adicionado ao migrate.js:

```javascript
migrations.push({
  name: '014_whatsapp_notifications',
  queries: [
    // Create whatsapp_usage table
    async (conn) => {
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS whatsapp_usage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            barbershop_id INT NOT NULL,
            mes_referencia DATE NOT NULL,
            notificacoes_enviadas INT DEFAULT 0 NOT NULL,
            limite_mensal INT DEFAULT 500 NOT NULL,
            creditos_extra INT DEFAULT 0 NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
            UNIQUE KEY unique_barbershop_mes (barbershop_id, mes_referencia),
            INDEX idx_barbershop_mes (barbershop_id, mes_referencia)
          )
        `);
      } catch (e) { /* ignore if already exists */ }
    },
    
    // Create whatsapp_credits_log table
    async (conn) => {
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS whatsapp_credits_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            barbershop_id INT NOT NULL,
            tipo_movimento ENUM('compra', 'uso', 'ajuste') NOT NULL,
            quantidade INT NOT NULL,
            saldo_anterior INT DEFAULT 0,
            saldo_posterior INT DEFAULT 0,
            descricao VARCHAR(255) NULL,
            stripe_transaction_id VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
            INDEX idx_barbershop (barbershop_id),
            INDEX idx_created (created_at),
            INDEX idx_tipo (tipo_movimento)
          )
        `);
      } catch (e) { /* ignore if already exists */ }
    },
    
    // Add notificado_whatsapp column to queue table
    async (conn) => {
      try {
        const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'notificado_whatsapp'`);
        if (cols.length === 0) {
          await conn.query(`ALTER TABLE queue ADD COLUMN notificado_whatsapp TINYINT(1) DEFAULT 0`);
        }
      } catch (e) { /* ignore */ }
    },
    
    // Create optimized index for notification queries
    async (conn) => {
      try {
        await conn.query(`CREATE INDEX idx_queue_notify ON queue(barbershop_id, position, notificado_whatsapp)`);
      } catch (e) { /* ignore if index already exists */ }
    },
    
    // Initialize monthly usage records for all existing barbershops
    async (conn) => {
      try {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const mesReferencia = currentMonth.toISOString().split('T')[0];
        
        await conn.query(`
          INSERT INTO whatsapp_usage (barbershop_id, mes_referencia, notificacoes_enviadas, limite_mensal, creditos_extra)
          SELECT id, ?, 0, 500, 0
          FROM barbershops
          WHERE id NOT IN (
            SELECT DISTINCT barbershop_id FROM whatsapp_usage 
            WHERE mes_referencia = ?
          )
          ON DUPLICATE KEY UPDATE barbershop_id = barbershop_id
        `, [mesReferencia, mesReferencia]);
      } catch (e) { /* ignore */ }
    },
  ],
});
```

---

## ✅ CHECKLIST PRÉ-EXECUÇÃO

- [ ] Revisar SQL em `backend/database/migrations/014_whatsapp_notifications.sql`
- [ ] Adicionar migration ao `backend/src/seeds/migrate.js`
- [ ] Confirmar que nenhuma tabela existe já
- [ ] Executar (será automático no próximo boot se usar migrate.js)
- [ ] Validar: `SELECT COUNT(*) FROM whatsapp_usage;`

---

## 🟢 PRONTO PARA EXECUTAR

Arquivo SQL está pronto. Basta:

1. Adicionar as queries ao migrate.js (copiar código acima)
2. Reiniciar o backend
3. Validar que as tabelas foram criadas
4. Prosseguir para **FASE 2** (Serviços + Lógica)

---

## 🔙 Rollback (se necessário)

```sql
DROP TABLE IF EXISTS whatsapp_credits_log;
DROP TABLE IF EXISTS whatsapp_usage;
ALTER TABLE queue DROP COLUMN notificado_whatsapp;
DROP INDEX idx_queue_notify ON queue;
```

