# HUUK System Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Railway (Recommended for Beginners)

1. **Prepare Your Code**
   ```bash
   # Create production build script
   cd client && npm run build
   ```

2. **Create railway.json**
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "cd server && npm start",
       "healthcheckPath": "/api/health"
     }
   }
   ```

3. **Environment Variables** (Set in Railway dashboard)
   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=your-railway-mysql-host
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=huuk
   JWT_SECRET=your-jwt-secret
   STRIPE_SECRET_KEY=your-stripe-key
   TWILIO_ACCOUNT_SID=your-twilio-sid
   TWILIO_AUTH_TOKEN=your-twilio-token
   TWILIO_PHONE_NUMBER=your-twilio-number
   GMAIL_USER=your-gmail
   GMAIL_PASS=your-app-password
   ALLOWED_ORIGINS=https://your-domain.com
   ```

4. **Deploy Steps**
   - Push to GitHub
   - Connect Railway to your GitHub repo
   - Add MySQL database service
   - Deploy automatically

### Option 2: VPS Deployment (DigitalOcean/Exabytes)

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install MySQL
   sudo apt install mysql-server -y
   sudo mysql_secure_installation
   
   # Install Nginx
   sudo apt install nginx -y
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/huuk-system.git
   cd huuk-system
   
   # Setup backend
   cd server
   npm install --production
   
   # Setup frontend
   cd ../client
   npm install
   npm run build
   
   # Move build to server
   cp -r build/* ../server/public/
   ```

3. **Database Setup**
   ```bash
   # Create database
   sudo mysql -u root -p
   CREATE DATABASE huuk;
   CREATE USER 'huukuser'@'localhost' IDENTIFIED BY 'strong_password';
   GRANT ALL PRIVILEGES ON huuk.* TO 'huukuser'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   
   # Run migrations
   mysql -u huukuser -p huuk < server/migrations/create_slot_reservations.sql
   ```

4. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **SSL Certificate**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d your-domain.com
   ```

6. **Start Application**
   ```bash
   cd server
   pm2 start app.js --name "huuk-system"
   pm2 startup
   pm2 save
   ```

### Option 3: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   # Multi-stage build
   FROM node:18-alpine AS client-build
   WORKDIR /app/client
   COPY client/package*.json ./
   RUN npm install
   COPY client/ ./
   RUN npm run build
   
   FROM node:18-alpine AS server
   WORKDIR /app
   COPY server/package*.json ./
   RUN npm install --production
   COPY server/ ./
   COPY --from=client-build /app/client/build ./public
   
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

2. **Docker Compose**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
         - DB_HOST=db
         - DB_USER=root
         - DB_PASSWORD=password
         - DB_NAME=huuk
       depends_on:
         - db
     
     db:
       image: mysql:8.0
       environment:
         - MYSQL_ROOT_PASSWORD=password
         - MYSQL_DATABASE=huuk
       volumes:
         - mysql_data:/var/lib/mysql
   
   volumes:
     mysql_data:
   ```

## 🔧 Production Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Set up SSL certificate
- [ ] Configure database backups
- [ ] Set up monitoring (PM2/Docker logs)
- [ ] Configure file upload limits
- [ ] Set up error logging
- [ ] Test payment integration
- [ ] Test SMS functionality
- [ ] Set up domain DNS

## 📱 Mobile App Considerations

Your project has Electron integration. For mobile:
- Consider React Native version
- Or Progressive Web App (PWA)
- Use Capacitor for hybrid mobile app

## 🚨 Security Notes

- Never commit .env files
- Use strong JWT secrets
- Enable MySQL SSL
- Set up firewall rules
- Regular security updates
- Monitor for suspicious activity

## 💰 Cost Estimates

**Railway/Render**: $10-25/month
**VPS (DigitalOcean)**: $5-20/month
**AWS/GCP**: $15-50/month (varies with usage)

Choose based on your technical comfort level and budget!