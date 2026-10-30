# Render에서 Node 24 환경으로 빌드합니다. 개인 DB·API 키는 .dockerignore로 제외합니다.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Linux 서버에서도 Instagram의 공개 화면을 읽을 수 있게 Chromium과 실행 라이브러리를 설치합니다.
RUN npx playwright-core install --with-deps chromium
COPY . .
RUN npm run build
ENV NODE_ENV=production BAKING_PUBLIC_DEMO=true BAKING_DATA_DIR=/tmp/baking-demo-data TRENDS_AUTO=false
RUN chown -R node:node /app
USER node
EXPOSE 10000
CMD ["sh", "-c", "npm run db:setup && node scripts/start-server.mjs"]
