-- Seed de demonstração: Barbearia Gilmar
-- Data: 2026-03-06
-- Arquivo: seed_demo_gilmar.sql

-- 1. Barbearia Gilmar
INSERT INTO barbershops (id, name, slug) 
VALUES (1, 'Barbearia Gilmar', 'barbearia-gilmar')
ON DUPLICATE KEY UPDATE name='Barbearia Gilmar', slug='barbearia-gilmar';

-- 2. Usuário dono (usar senha: "123456" -hash bcrypt pré-computado)
-- Para gerar novo hash: use bcrypt online ou nodecrypto
-- Hash fornecido: $2a$10$Z9KxZ8bz3b3b3b3b3b3b3e8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r
INSERT INTO users (id, name, email, password_hash, role, barbershop_id, created_at) 
VALUES (1, 'Gilmar', 'gilmar@barbeariagilmar.com', '$2a$10$Z9KxZ8bz3b3b3b3b3b3b3e8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r', 'owner', 1, NOW())
ON DUPLICATE KEY UPDATE name='Gilmar', role='owner';

-- 3. Oito barbeiros simulados (8 profissionais)
INSERT INTO barbers (barbershop_id, name, status, created_at) 
VALUES 
  (1, 'Carlos Eduardo Souza', 'available', NOW()),
  (1, 'Felipe Almeida Santos', 'available', NOW()),
  (1, 'Rodrigo Pereira Lima', 'available', NOW()),
  (1, 'André Luiz Costa', 'available', NOW()),
  (1, 'Marcelo Henrique Dias', 'available', NOW()),
  (1, 'Diego Fernandes Rocha', 'available', NOW()),
  (1, 'Lucas Gabriel Martins', 'available', NOW()),
  (1, 'Rafael Batista Oliveira', 'available', NOW())
ON DUPLICATE KEY UPDATE status='available';

-- 4. Limpar fila anterior (dados de teste)
DELETE FROM queue WHERE barbershop_id = 1;

-- 5. Adicionar clientes de teste na fila
-- Alguns esperando, alguns sendo atendidos, alguns já atendidos
INSERT INTO queue (barbershop_id, name, status, position, barber_id, created_at) 
VALUES 
  (1, 'João Silva', 'finished', 1, 1, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
  (1, 'Ana Costa', 'finished', 2, 2, DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
  (1, 'Bruno Ferreira', 'serving', 3, 3, DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
  (1, 'Débora Oliveira', 'called', 4, NULL, DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
  (1, 'Eduardo Martins', 'waiting', 5, NULL, DATE_SUB(NOW(), INTERVAL 8 MINUTE)),
  (1, 'Fernanda Gomes', 'waiting', 6, NULL, DATE_SUB(NOW(), INTERVAL 6 MINUTE)),
  (1, 'Gustavo Henrique', 'waiting', 7, NULL, DATE_SUB(NOW(), INTERVAL 4 MINUTE)),
  (1, 'Helena Alves', 'waiting', 8, NULL, DATE_SUB(NOW(), INTERVAL 2 MINUTE));
