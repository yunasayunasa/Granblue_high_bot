# --- ビルドステージ ---
    FROM node:18-slim AS builder
    RUN corepack enable
    RUN corepack prepare pnpm@latest --activate
    WORKDIR /usr/src/app
    COPY package.json pnpm-lock.yaml ./
    # COPY pnpm-workspace.yaml ./ # もしあれば
    RUN pnpm install --frozen-lockfile
    COPY . .
    # RUN pnpm build # もしビルドステップがあれば
    
    # --- 本番ステージ ---
    FROM node:18-slim
    RUN corepack enable
    RUN corepack prepare pnpm@latest --activate
    WORKDIR /usr/src/app
    COPY package.json pnpm-lock.yaml ./
    # COPY pnpm-workspace.yaml ./ # もしあれば
    RUN pnpm install --prod --frozen-lockfile
    COPY --from=builder /usr/src/app .
    EXPOSE 8080
    CMD [ "node", "index.js" ]
