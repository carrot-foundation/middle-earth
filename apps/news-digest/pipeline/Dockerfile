#########################################
# ---------- Build Stage ----------------
#########################################
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prefer-offline

COPY apps/news-digest/pipeline/ apps/news-digest/pipeline/
COPY tsconfig.base.json ./

RUN npx esbuild apps/news-digest/pipeline/src/main.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --outfile=dist/main.js \
    --format=esm \
    --external:playwright \
    --external:@aws-sdk/*

#########################################
# ---------- Production Stage -----------
#########################################
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

RUN npm install -g pnpm@10

COPY --from=builder /app/dist/main.js ./main.js
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prefer-offline --prod

RUN npx playwright install chromium

USER pwuser

ENTRYPOINT ["node", "main.js"]
