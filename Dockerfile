FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev deps needed for the build step)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies after build to save space
RUN npm prune --omit=dev

# Create uploads directory
RUN mkdir -p uploads/products uploads/digital-files uploads/avatars

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]