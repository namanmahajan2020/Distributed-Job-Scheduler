FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build -w @scheduler/shared && npm run build -w @scheduler/api
CMD ["npm", "run", "dev:api"]
