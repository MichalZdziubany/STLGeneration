# Frontend Dockerfile
FROM node:24-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app, including src/
COPY . .

# Expose default Next.js port
EXPOSE 3000
