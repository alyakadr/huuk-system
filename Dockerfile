# Simple Node.js backend deployment for Railway
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy server package files
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy server source code
COPY server/ ./

# Create necessary directories
RUN mkdir -p uploads receipts logs public

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]