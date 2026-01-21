# IMMEDIATE DEPLOYMENT STEPS FOR HUUK SYSTEM

## 🚀 Deploy Right Now - Step by Step

### Step 1: GitHub Setup (5 minutes)

```bash
# Run these commands in your project root
git init
git add .
git commit -m "Initial commit: HUUK booking management system"

# Create GitHub repository at: https://github.com/new
# Then run:
git remote add origin https://github.com/YOURUSERNAME/huuk-system.git
git branch -M main
git push -u origin main
```

### Step 2: Railway Backend Deployment (10 minutes)

1. **Go to Railway.app and sign up/login**
2. **Click "New Project" → "Deploy from GitHub repo"**
3. **Select your huuk-system repository**
4. **Configure these environment variables in Railway:**

```env
NODE_ENV=production
PORT=5000
DB_HOST=db.ruzentra.com
DB_USER=ruzentra_huukbarber
DB_PASSWORD=huukbarber02@
DB_NAME=ruzentra_huukbarber
JWT_SECRET=huuk_jwt_secret_2024_change_this
ALLOWED_ORIGINS=https://huukbarber.ruzentra.com
STRIPE_SECRET_KEY=your_stripe_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
GMAIL_USER=your_gmail@gmail.com
GMAIL_PASS=your_gmail_app_password
```

5. **Set Root Directory to:** `server`
6. **Deploy!** Railway will give you a URL like: `https://your-app.railway.app`

### Step 3: Database Setup (15 minutes)

1. **Access Ruzentra Control Panel**
2. **Open phpMyAdmin or Database Manager**
3. **Create database:** `ruzentra_huukbarber` (if not exists)
4. **Run these SQL commands:**

```sql
-- Basic tables for HUUK system
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'staff', 'manager') DEFAULT 'customer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outlets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    shortform VARCHAR(10) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    duration INT NOT NULL, -- in minutes
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    outlet_id INT NOT NULL,
    service_id INT NOT NULL,
    staff_id INT,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (outlet_id) REFERENCES outlets(id),
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- Insert sample data
INSERT INTO outlets (name, shortform) VALUES 
('HUUK Barber Main', 'MAIN'),
('HUUK Barber Branch', 'BRANCH');

INSERT INTO services (name, duration, price) VALUES 
('Hair Cut', 30, 25.00),
('Hair Wash', 15, 10.00),
('Beard Trim', 20, 15.00),
('Full Service', 60, 45.00);
```

### Step 4: Frontend Deployment (10 minutes)

1. **Update API URL in your React app**

Create/update `client/src/config/api.js`:
```javascript
const config = {
  development: {
    apiUrl: 'http://localhost:5000'
  },
  production: {
    apiUrl: 'https://your-app.railway.app' // Replace with your Railway URL
  }
};

export const API_URL = config[process.env.NODE_ENV || 'development'].apiUrl;
```

2. **Update your API calls to use this URL**

In `client/src/api/client.js` or wherever you make API calls:
```javascript
import { API_URL } from '../config/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

3. **Build and deploy frontend**

```bash
# Build the React app
cd client
npm run build

# The GitHub Action will automatically deploy to your FTP
# Or manually upload the build/ folder contents to your Ruzentra FTP
```

### Step 5: GitHub Actions Setup (5 minutes)

1. **Go to your GitHub repository**
2. **Settings → Secrets and variables → Actions**
3. **Add these secrets:**
   - `FTP_USERNAME`: `huukbarber@ruzentra.com`
   - `FTP_PASSWORD`: `huukbarber02@`
   - `REACT_APP_API_URL`: `https://your-app.railway.app`

4. **Push any change to trigger deployment:**
```bash
git add .
git commit -m "Configure production deployment"
git push
```

### Step 6: Test Everything (10 minutes)

1. **Test Backend:** Visit your Railway URL
2. **Test Frontend:** Visit https://huukbarber.ruzentra.com
3. **Test Database:** Try creating a user/booking
4. **Test Integration:** Full booking flow

---

## 🎯 Expected Results:

- **Frontend:** https://huukbarber.ruzentra.com
- **Backend API:** https://your-app.railway.app
- **Database:** Connected to db.ruzentra.com
- **Auto-deployment:** Every GitHub push updates frontend

## 🚨 Troubleshooting:

**If frontend shows blank page:**
- Check browser console for errors
- Verify API URL is correct
- Check .htaccess file is uploaded

**If backend can't connect to database:**
- Verify database credentials in Railway
- Check if database exists in Ruzentra
- Test connection from Railway logs

**If CORS errors:**
- Update ALLOWED_ORIGINS in Railway
- Check API URL in frontend config

## 💡 Next Steps After Deployment:

1. Set up SSL certificate (usually automatic with Ruzentra)
2. Configure domain DNS if needed
3. Set up monitoring and backups
4. Test payment integration
5. Test SMS notifications

**Total Time:** ~45 minutes for full deployment!
**Monthly Cost:** ~RM20-30 for Railway backend