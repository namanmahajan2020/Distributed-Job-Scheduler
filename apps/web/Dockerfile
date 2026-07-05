FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY . .
RUN npm run build -w @scheduler/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
