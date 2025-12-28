# Example Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
