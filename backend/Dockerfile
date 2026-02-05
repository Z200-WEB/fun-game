# Dockerfile for backend deployment
# NOTE: Railway/Render use Nixpacks by default, which works better
# This Dockerfile is for manual Docker builds from the ROOT directory:
#   docker build -f backend/Dockerfile -t clash-server .

FROM node:20-alpine

WORKDIR /app

# Copy shared constants first
COPY shared ./shared

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend/src ./src

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "src/index.js"]
