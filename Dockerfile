# --- web client build (Expo web export of mobile-client) ---
FROM node:22-alpine AS web
WORKDIR /app/mobile-client
COPY mobile-client/package*.json ./
RUN npm ci
COPY mobile-client/ ./
# Mirrors mobile-client/.env.prod, which is gitignored and so never reaches a
# build from GitHub. Railway overrides it with the service variable of the same
# name, which it passes in as a build arg because it is declared here.
ARG EXPO_PUBLIC_SERVER_URL=wss://monopoly-deal-game.up.railway.app/ws
ENV EXPO_PUBLIC_SERVER_URL=$EXPO_PUBLIC_SERVER_URL CI=1
RUN npx expo export --platform web --output-dir dist

# --- backend build ---
FROM golang:1.25-alpine AS backend
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o server_bin .

# --- runtime ---
FROM alpine:3.20
WORKDIR /app
COPY --from=backend /app/backend/server_bin ./server_bin
COPY --from=web /app/mobile-client/dist ./web

ENV STATIC_DIR=/app/web
EXPOSE 8080

CMD ["./server_bin"]
