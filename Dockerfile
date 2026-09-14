# --- frontend build ---
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

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
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV STATIC_DIR=/app/frontend/dist
EXPOSE 8080

CMD ["./server_bin"]
