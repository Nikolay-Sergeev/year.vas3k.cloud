FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY public ./public
COPY src ./src
COPY tsconfig.json ./
RUN GENERATE_SOURCEMAP=false npm run build

FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
LABEL org.opencontainers.image.title="Nikolai Calendar" \
      org.opencontainers.image.version="1.4.3" \
      org.opencontainers.image.source="https://github.com/Nikolay-Sergeev/year.vas3k.cloud"
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=builder --chown=node:node /app/build ./build
COPY --chown=node:node server ./server
USER node
EXPOSE 8080
CMD ["node", "server/index.cjs"]
