# GitHub Repository Setup for HUUK System

## 🚀 Quick Setup Steps

### 1. Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: HUUK booking management system"

# Add remote repository
git remote add origin https://github.com/yourusername/huuk-system.git

# Push to GitHub
git push -u origin main
```

### 2. Repository Structure

Your repository should look like this:
```
huuk-system/
├── client/                 # React frontend
├── server/                 # Node.js backend
├── docker-compose.yml      # Docker deployment
├── Dockerfile             # Container build
├── deployment-guide.md    # Deployment instructions
├── env.example           # Environment variables template
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```

### 3. Create .gitignore

```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
client/build/
server/public/
dist/

# Database
*.db
*.sqlite

# Uploads and generated files
server/uploads/
server/receipts/
uploads/
receipts/

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Docker
.dockerignore

# Temporary files
tmp/
temp/
```

### 4. Update README.md

```markdown
# HUUK Booking Management System

A comprehensive booking management system for salons/spas with customer booking, staff management, and payment processing.

## 🌟 Features

- **Customer Portal**: Book appointments, view history, make payments
- **Staff Dashboard**: Manage appointments, view schedules, track attendance
- **Manager Panel**: Staff management, sales reports, system administration
- **Real-time Updates**: Socket.IO for live notifications
- **Payment Integration**: Stripe payment processing
- **SMS Notifications**: Twilio integration for booking confirmations
- **Multi-role Authentication**: Customer, Staff, Manager roles

## 🛠️ Tech Stack

**Frontend:**
- React 18 with Material-UI
- Socket.IO client for real-time features
- Stripe integration for payments
- Chart.js for analytics

**Backend:**
- Node.js with Express
- MySQL database
- Socket.IO for real-time communication
- JWT authentication
- Twilio for SMS
- Nodemailer for emails

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/huuk-system.git
   cd huuk-system
   ```

2. **Setup Database**
   ```sql
   CREATE DATABASE huuk;
   ```

3. **Install Dependencies**
   ```bash
   # Backend
   cd server
   npm install
   
   # Frontend
   cd ../client
   npm install
   ```

4. **Configure Environment**
   ```bash
   # Copy environment template
   cp env.example server/.env
   # Edit server/.env with your configuration
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm start
   
   # Terminal 2 - Frontend
   cd client
   npm start
   ```

6. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🚀 Deployment

See [deployment-guide.md](deployment-guide.md) for detailed deployment instructions.

### Quick Deploy Options:
- **Railway**: One-click deploy from GitHub
- **DigitalOcean**: VPS with full control
- **Docker**: Container-based deployment

## 📱 User Roles

### Customer
- Book appointments
- View booking history
- Make payments
- Manage profile

### Staff
- View assigned appointments
- Mark attendance
- Update appointment status
- View earnings

### Manager
- Staff management
- Sales reports
- System configuration
- Customer management

## 🔧 Configuration

Key environment variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`: Database connection
- `JWT_SECRET`: Authentication secret
- `STRIPE_SECRET_KEY`: Payment processing
- `TWILIO_*`: SMS notifications
- `GMAIL_*`: Email notifications

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@huuksystem.com or create an issue on GitHub.

## 🙏 Acknowledgments

- Material-UI for the beautiful components
- Stripe for payment processing
- Twilio for SMS services
- All contributors who helped build this system
```

### 5. GitHub Actions (Optional CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd client && npm ci
        cd ../server && npm ci
        
    - name: Build frontend
      run: cd client && npm run build
      
    - name: Run tests
      run: |
        cd server && npm test
        
    - name: Deploy to server
      # Add your deployment script here
      run: echo "Deploy to your server"
```

## 🎯 Repository Best Practices

### Branch Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: Feature branches
- `hotfix/*`: Critical fixes

### Commit Messages
```
feat: add customer booking history page
fix: resolve payment processing error
docs: update deployment guide
style: format code with prettier
refactor: optimize database queries
test: add unit tests for booking controller
```

### Security
- Never commit `.env` files
- Use GitHub Secrets for sensitive data
- Enable branch protection rules
- Require pull request reviews

## 📊 Project Metrics

Track your project with:
- GitHub Issues for bug tracking
- GitHub Projects for task management
- GitHub Actions for CI/CD
- GitHub Releases for version management

This setup will make your project professional and deployment-ready! 🚀