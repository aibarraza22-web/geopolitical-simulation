FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install

COPY apps/web ./apps/web

EXPOSE 5174
CMD ["pnpm", "--filter", "web", "dev", "--host"]
