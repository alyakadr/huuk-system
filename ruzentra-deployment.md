# HUUK System Deployment to Ruzentra Hosting

## 🎯 Your Current Setup
- **Domain**: huukbarber.ruzentra.com
- **FTP Host**: 101.99.69.151
- **Database**: db.ruzentra.com
- **FTP Manager**: https://monsta.ruzentra.com

## 🚀 Deployment Strategy

### Option 1: Static Frontend + External Backend (Recommended)

Since most shared hosting doesn't support Node.js backend, we'll deploy:
- **Frontend**: Static React build on Ruzentra
- **Backend**: External service (Railway/Render/Heroku)

### Option 2: Full Stack (If Ruzentra supports Node.js)

If your hosting supports Node.js, we can deploy everything together.

---

## 📋 Step-by-Step Deployment

### Step 1: Prepare Your Frontend for Production

1. **Update API URLs in your React app**
   ```javascript
   // In client/src/api/client.js or similar
   const API_BASE_URL = process.env.NODE_ENV === 'production' 
     ? 'https://your-backend-url.com/api'  // External backend
     : 'http://localhost:5000/api';        // Local development
   ```

2. **Build the React app**
   ```bash
   cd client
   npm install
   npm run build
   ```

3. **Test the build locally**
   ```bash
   npx serve -s build
   ```

### Step 2: Deploy Frontend to Ruzentra

1. **Access FTP Manager**
   - Go to: https://monsta.ruzentra.com
   - Login with: huukbarber@ruzentra.com / huukbarber02@

2. **Upload Files**
   - Navigate to `public_html` or your domain folder
   - Upload all contents from `client/build/` folder
   - Make sure `index.html` is in the root directory

3. **File Structure on Server**
   ```
   public_html/
   ├── index.html
   ├── static/
   │   ├── css/
   │   ├── js/
   │   └── media/
   ├── manifest.json
   └── favicon.ico
   ```

### Step 3: Setup Database Connection

1. **Update Database Configuration**
   ```javascript
   // server/config/db.js
   const mysql = require("mysql2/promise");

   const pool = mysql.createPool({
     host: "db.ruzentra.com",
     user: "ruzentra_huukbarber",
     password: "huukbarber02@",
     database: "ruzentra_huukbarber", // Your database name
     waitForConnections: true,
     connectionLimit: 10,
     queueLimit: 0,
   });
   ```

2. **Create Database Tables**
   - Access phpMyAdmin through your hosting panel
   - Import your SQL migration files
   - Or run SQL commands manually

### Step 4: Deploy Backend (External Service)

Since shared hosting typically doesn't support Node.js, deploy backend externally:

#### Option A: Railway (Recommended)
1. Push your code to GitHub
2. Connect Railway to your repository
3. Set environment variables:
   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=db.ruzentra.com
   DB_USER=ruzentra_huukbarber
   DB_PASSWORD=huukbarber02@
   DB_NAME=ruzentra_huukbarber
   ALLOWED_ORIGINS=https://huukbarber.ruzentra.com
   ```

#### Option B: Render
1. Connect GitHub repository
2. Set build command: `cd server && npm install`
3. Set start command: `cd server && npm start`
4. Configure environment variables

### Step 5: Update Frontend Configuration

Update your React app to point to the external backend:

```javascript
// client/src/config/api.js
const config = {
  development: {
    apiUrl: 'http://localhost:5000'
  },
  production: {
    apiUrl: 'https://your-backend-url.railway.app' // Your Railway/Render URL
  }
};

export const API_URL = config[process.env.NODE_ENV || 'development'].apiUrl;
```

---

## 🔧 GitHub Actions for Automatic Deployment

Create `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to Ruzentra

on:
  push:
    branches: [ main ]
    paths: [ 'client/**' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd client
        npm ci
        
    - name: Build React app
      run: |
        cd client
        npm run build
        
    - name: Deploy to FTP
      uses: SamKirkland/FTP-Deploy-Action@v4.3.4
      with:
        server: 101.99.69.151
        username: ${{ secrets.FTP_USERNAME }}
        password: ${{ secrets.FTP_PASSWORD }}
        local-dir: ./client/build/
        server-dir: ./public_html/
        exclude: |
          **/.git*
          **/.git*/**
          **/node_modules/**
```

### GitHub Secrets Setup
In your GitHub repository settings, add:
- `FTP_USERNAME`: huukbarber@ruzentra.com
- `FTP_PASSWORD`: huukbarber02@

---

## 🗄️ Database Setup

### Create Database Structure

1. **Access phpMyAdmin**
   - Usually available through your hosting control panel
   - Or direct link from Ruzentra

2. **Create Tables**
   ```sql
   -- Run your migration files
   USE ruzentra_huukbarber;
   
   -- Import your table structures
   SOURCE /path/to/your/migrations/create_tables.sql;
   ```

3. **Test Connection**
   ```javascript
   // Test script
   const mysql = require('mysql2/promise');
   
   async function testConnection() {
     try {
       const connection = await mysql.createConnection({
         host: 'db.ruzentra.com',
         user: 'ruzentra_huukbarber',
         password: 'huukbarber02@',
         database: 'ruzentra_huukbarber'
       });
       
       console.log('Database connected successfully!');
       await connection.end();
     } catch (error) {
       console.error('Database connection failed:', error);
     }
   }
   
   testConnection();
   ```

---

## 🔒 Security Considerations

1. **Environment Variables**
   - Never commit passwords to GitHub
   - Use GitHub Secrets for sensitive data

2. **Database Security**
   - Change default passwords
   - Limit database user permissions
   - Use SSL connections if available

3. **CORS Configuration**
   ```javascript
   // server/app.js
   const allowedOrigins = [
     'https://huukbarber.ruzentra.com',
     'http://localhost:3000' // for development
   ];
   
   app.use(cors({
     origin: allowedOrigins,
     credentials: true
   }));
   ```

---

## 📱 Testing Your Deployment

1. **Frontend Test**
   - Visit: https://huukbarber.ruzentra.com
   - Check if React app loads correctly
   - Test navigation and UI components

2. **Backend Test**
   - Test API endpoints
   - Check database connections
   - Verify authentication works

3. **Integration Test**
   - Test booking flow
   - Check payment integration
   - Verify SMS notifications

---

## 🚨 Troubleshooting

### Common Issues:

1. **404 Errors on Refresh**
   - Add `.htaccess` file to handle React Router:
   ```apache
   Options -MultiViews
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^ index.html [QR,L]
   ```

2. **CORS Errors**
   - Update ALLOWED_ORIGINS in backend
   - Check API URLs in frontend

3. **Database Connection Issues**
   - Verify credentials
   - Check if database exists
   - Ensure tables are created

---

## 💡 Next Steps

1. **Set up monitoring** for your backend service
2. **Configure SSL** for your domain (usually free with hosting)
3. **Set up backups** for your database
4. **Monitor performance** and optimize as needed

Would you like me to help you with any specific part of this deployment process?