FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/worker/package.json apps/worker/package.json
RUN npm install
COPY . .
CMD ["npm", "run", "dev:worker"]
