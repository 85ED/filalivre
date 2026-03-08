/**
 * Seed Reset Script
 * Limpa todos os dados e insere estado inicial para testes
 *
 * Barbearia Gilmar
 * 4 barbeiros: Carlos Silva (online), João Pedro (online), Rafael Costa (offline), Diego Martins (offline)
 * 0 clientes na fila
 *
 * Uso: node scripts/seed-reset.js
 */

import mysql from 'mysql2/promise';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'fila',
};

async function seed() {
  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    console.log('🔄 Iniciando reset do banco...\n');

    // Desativar FK checks temporariamente
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Limpar tabelas
    await connection.query('TRUNCATE TABLE queue');
    await connection.query('TRUNCATE TABLE barbers');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('TRUNCATE TABLE barbershops');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Tabelas limpas');

    // 1. Criar barbearia
    const [barbershopResult] = await connection.query(
      "INSERT INTO barbershops (name, slug) VALUES ('Barbearia Gilmar', 'barbearia-gilmar')"
    );
    const barbershopId = barbershopResult.insertId;
    console.log(`✓ Barbearia criada (id: ${barbershopId})`);

    // 2. Criar barbeiros
    const barbers = [
      { name: 'Carlos Silva', status: 'available' },
      { name: 'João Pedro', status: 'available' },
      { name: 'Rafael Costa', status: 'paused' },
      { name: 'Diego Martins', status: 'paused' },
    ];

    for (const barber of barbers) {
      const [result] = await connection.query(
        'INSERT INTO barbers (barbershop_id, name, status) VALUES (?, ?, ?)',
        [barbershopId, barber.name, barber.status]
      );
      console.log(`✓ Barbeiro: ${barber.name} (id: ${result.insertId}, status: ${barber.status})`);
    }

    // 3. Criar usuário admin (Gilmar)
    const passwordHash = await bcryptjs.hash('123456', 10);
    await connection.query(
      'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [barbershopId, 'Gilmar', 'gilmar@barbearia.com', passwordHash, 'owner']
    );
    console.log('✓ Admin: gilmar@barbearia.com / 123456');

    // 4. Criar usuários barbeiros (para login)
    const barberUsers = [
      { name: 'Carlos Silva', email: 'carlos@barbearia.com' },
      { name: 'João Pedro', email: 'joao@barbearia.com' },
      { name: 'Rafael Costa', email: 'rafael@barbearia.com' },
      { name: 'Diego Martins', email: 'diego@barbearia.com' },
    ];

    for (const user of barberUsers) {
      await connection.query(
        'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [barbershopId, user.name, user.email, passwordHash, 'barber']
      );
      console.log(`✓ Usuário barbeiro: ${user.email} / 123456`);
    }

    console.log('\n════════════════════════════════════════');
    console.log('  SEED CONCLUÍDO COM SUCESSO');
    console.log('════════════════════════════════════════');
    console.log(`  Barbearia: Barbearia Gilmar (id: ${barbershopId})`);
    console.log('  Barbeiros: 4 cadastrados');
    console.log('    - Carlos Silva  → Online');
    console.log('    - João Pedro    → Online');
    console.log('    - Rafael Costa  → Offline');
    console.log('    - Diego Martins → Offline');
    console.log('  Clientes na fila: 0');
    console.log('  Admin: gilmar@barbearia.com / 123456');
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    console.error('✗ Erro no seed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch(() => process.exit(1));
