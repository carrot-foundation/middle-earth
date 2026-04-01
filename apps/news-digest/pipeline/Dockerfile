#########################################
# ---------- Build Stage ----------------
#########################################
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.2.0

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
FROM mcr.microsoft.com/playwright:v1.59.0-noble

WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq xvfb > /dev/null 2>&1 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.2.0

COPY --from=builder /app/dist/main.js ./main.js
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prefer-offline --prod --ignore-scripts

RUN npx playwright install chromium

USER pwuser

ENV DISPLAY=:99

ENTRYPOINT ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 &>/dev/null & sleep 1 && node main.js"]
