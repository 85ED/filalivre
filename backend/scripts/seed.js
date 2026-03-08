import pool from '../src/config/database.js';
import { hashPassword } from '../src/middlewares/validators.js';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Create barbershops
    console.log('  Creating barbershops...');
    const [barbershopResult] = await pool.query(
      'INSERT INTO barbershops (name, slug) VALUES (?, ?)',
      ['Barbershop Premium', 'barbershop-premium']
    );
    const barbershopId = barbershopResult.insertId;
    console.log(`  ✓ Created barbershop: ${barbershopId}`);

    // Create owner user
    console.log('  Creating owner user...');
    const ownerPassword = await hashPassword('owner123');
    const [ownerResult] = await pool.query(
      'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [barbershopId, 'João Owner', 'owner@barbershop.com', ownerPassword, 'owner']
    );
    const ownerId = ownerResult.insertId;
    console.log(`  ✓ Created owner: ${ownerId}`);

    // Create admin users
    console.log('  Creating admin users...');
    const adminPassword = await hashPassword('admin123');
    const [adminResult1] = await pool.query(
      'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [barbershopId, 'Maria Admin', 'admin@barbershop.com', adminPassword, 'admin']
    );
    console.log(`  ✓ Created admin: ${adminResult1.insertId}`);

    // Create barber users
    console.log('  Creating barber users...');
    const barberUsers = [
      { name: 'Carlos', email: 'carlos@barbershop.com' },
      { name: 'Pedro', email: 'pedro@barbershop.com' },
      { name: 'Felipe', email: 'felipe@barbershop.com' }
    ];

    const barberIds = [];
    for (const barberUser of barberUsers) {
      const barberPassword = await hashPassword('barber123');
      const [barberUserResult] = await pool.query(
        'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [barbershopId, barberUser.name, barberUser.email, barberPassword, 'barber']
      );
      console.log(`  ✓ Created barber user: ${barberUser.name}`);

      // Create barber profile
      const [barberResult] = await pool.query(
        'INSERT INTO barbers (barbershop_id, name, status) VALUES (?, ?, ?)',
        [barbershopId, barberUser.name, 'available']
      );
      barberIds.push(barberResult.insertId);
    }

    // Create sample queue entries
    console.log('  Creating sample queue...');
    const clientNames = ['Ana Silva', 'Bruno Costa', 'Diego Santos', 'Érica Lima'];
    
    for (let i = 0; i < clientNames.length; i++) {
      await pool.query(
        'INSERT INTO queue (barbershop_id, name, status, position) VALUES (?, ?, ?, ?)',
        [barbershopId, clientNames[i], 'waiting', i + 1]
      );
      console.log(`  ✓ Added to queue: ${clientNames[i]}`);
    }

    console.log('✅ Database seed completed successfully!');
    console.log(`
    ╔════════════════════════════════════════╗
    ║  Test Credentials                     ║
    ╠════════════════════════════════════════╣
    ║  Owner:                                ║
    ║    Email: owner@barbershop.com         ║
    ║    Password: owner123                  ║
    ║                                        ║
    ║  Admin:                                ║
    ║    Email: admin@barbershop.com         ║
    ║    Password: admin123                  ║
    ║                                        ║
    ║  Barbers:                              ║
    ║    carlos@barbershop.com - barber123   ║
    ║    pedro@barbershop.com - barber123    ║
    ║    felipe@barbershop.com - barber123   ║
    ║                                        ║
    ║  Queue: 4 waiting clients              ║
    ╚════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
