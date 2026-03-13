# Deployment Guide

## Prerequisites

- Node.js 16+ runtime environment
- MySQL 5.7+ or MySQL 8.0+
- SSL/TLS certificates (for production)

## Local Deployment

### 1. Database Setup
```bash
# Create .env file
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Run schema
mysql -u root -p < database/schema.sql

# Optionally seed demo data
npm run seed
```

### 2. Install & Run
```bash
mkdir backend
cd backend
npm install
npm run dev
```

Server runs on `http://localhost:3001`

## Docker Deployment

### Using Docker Compose (Recommended for development)
```bash
docker-compose up -d
```

Access:
- API: `http://localhost:3001`
- PHPMyAdmin: `http://localhost:8080`

### Production Docker Build
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t fila-backend .
docker run -p 3001:3001 --env-file .env fila-backend
```

## Cloud Deployment

### Heroku
```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login
heroku login

# Create app
heroku create fila-backend

# Add MySQL addon
heroku addons:create cleardb:ignite

# Set environment variables
heroku config:set JWT_SECRET=your_secret_key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run "mysql < database/schema.sql"
```

### AWS EC2
```bash
# SSH into instance
ssh -i key.pem ec2-user@your-instance

# Install Node
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt-get install -y mysql-server

# Clone repository
git clone your-repo
cd backend

# Setup environment
cp .env.example .env
nano .env

# Install and start
npm install
npm start

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name "fila-backend"
pm2 save
pm2 startup
```

### AWS RDS for Database
1. Create RDS MySQL instance
2. Set security groups to allow port 3306
3. Update DB_HOST in .env with RDS endpoint
4. Run schema on RDS instance

### Digital Ocean App Platform
1. Connect GitHub repository
2. Set environment variables:
   - `DB_HOST`: Your MySQL host
   - `DB_USER`: Database user
   - `DB_PASS`: Database password
   - `DB_NAME`: Database name
   - `JWT_SECRET`: Strong random secret
   - `NODE_ENV`: production
   - `PORT`: 3001

3. Deploy from GitHub

### Google Cloud Run
```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/fila-backend

# Deploy
gcloud run deploy fila-backend \
  --image gcr.io/PROJECT_ID/fila-backend \
  --platform managed \
  --set-env-vars=DB_HOST=your-cloud-sql-ip
```

## Environment Variables (Production)

```env
# Database
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASS=strong_password_here
DB_NAME=prod_filadb

# JWT - MUST be strong and secret
JWT_SECRET=your_production_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=production

# CORS - Set to your frontend domain
CORS_ORIGIN=https://yourdomain.com

# WhatsApp (wppconnect) — persistência de sessão
# IMPORTANTE: a sessão só persiste entre deploys se a pasta de tokens estiver em um volume persistente.
# Em produção, o padrão do serviço WhatsApp é usar /data/tokens (se existir). Você pode sobrescrever:
WHATSAPP_TOKENS_PATH=/data/tokens
```

## Nginx Configuration (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Set timeouts for long connections
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## SSL/TLS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.yourdomain.com
```

Update Nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    # ... rest of config
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## PM2 Process Manager

```bash
# Install globally
npm install -g pm2

# Start application
pm2 start server.js --name "fila-backend" --instances max

# Monitor
pm2 monit

# Restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs fila-backend

# Restart
pm2 restart fila-backend

# Stop
pm2 stop fila-backend

# Delete
pm2 delete fila-backend
```

## Database Backups

### Automated backups with mysqldump
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/var/backups/mysql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE="$BACKUP_DIR/filadb_$TIMESTAMP.sql"

mysqldump -u root -p$DB_PASS filadb > "$FILE"
gzip "$FILE"

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Schedule with cron:
```bash
0 2 * * * /path/to/backup.sh
```

## Monitoring & Logging

### Application Logs
```bash
pm2 logs fila-backend
tail -f ~/.pm2/logs/fila-backend-error.log
```

### Database Monitoring
```bash
# Check MySQL connections
mysql -e "SHOW PROCESSLIST;"

# Check slow queries
mysql -e "SET GLOBAL slow_query_log = 'ON';"
```

### Performance Monitoring
- Use New Relic, Datadog, or similar service
- Monitor: CPU, Memory, Response times, Errors
- Set up alerts for anomalies

## Troubleshooting

### Connection Refused
- Check MySQL is running: `sudo systemctl status mysql`
- Verify credentials in .env
- Check database exists

### Out of Memory
- Increase Node memory: `node --max-old-space-size=4096 server.js`
- Use PM2 with memory limit: `pm2 start server.js --max-memory-restart 1G`

### High Response Times
- Check database query performance
- Review queue size
- Consider adding Redis caching
- Scale horizontally (load balancing)

### CORS Errors
- Verify CORS_ORIGIN in .env matches frontend domain
- Check headers in preflight requests

## Health Check

Monitor with:
```bash
curl -X GET http://api.yourdomain.com/health
```

Should return:
```json
{"status": "ok", "timestamp": "2023-..."}
```

## Scaling Considerations

### Vertical Scaling (Single server)
- Increase server resources
- Use PM2 cluster mode

### Horizontal Scaling (Multiple servers)
- Use load balancer (Nginx, AWS ELB)
- Shared MySQL database
- Session management (if needed)

### Database Optimization
- Add indexes (already done)
- Read replicas for scaling reads
- Connection pooling (already configured)
- Query optimization

## Security Checklist

- [ ] Strong JWT_SECRET set
- [ ] DATABASE password is strong
- [ ] NODE_ENV=production
- [ ] CORS configured for your domain only
- [ ] SSL/TLS enabled
- [ ] Database firewall configured
- [ ] Regular backups enabled
- [ ] Monitoring enabled
- [ ] Rate limiting enabled (optional)
- [ ] SQL injection protected (parameterized queries used)
