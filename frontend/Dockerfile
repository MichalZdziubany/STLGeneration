# Frontend Dockerfile
FROM node:24-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app, including src/
COPY . .

# Build Next.js app
RUN npm run build

# Expose default Next.js port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
