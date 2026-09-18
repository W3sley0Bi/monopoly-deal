.PHONY: build run dev tunnel serve-public test clean

build:
	cd frontend && npm install && npm run build
	cd backend && go build -o server_bin .

run: build
	cd backend && ./server_bin

# Play with people off the LAN through a public tunnel.
NGROK_URL ?= https://polite-vulture-immune.ngrok-free.app

tunnel:
	ngrok http $${PORT:-8080} --url $(NGROK_URL)

# Server in the foreground of one terminal, tunnel in another (make tunnel).
serve-public: build
	cd backend && PORT=$${PORT:-8080} ./server_bin

dev:
	@echo "Run these in two terminals:"
	@echo "  cd backend  && go run ."
	@echo "  cd frontend && npm run dev"

test:
	cd backend && go test ./...
	cd frontend && npx tsc -b && npm run check:i18n

clean:
	rm -rf frontend/dist backend/server_bin
