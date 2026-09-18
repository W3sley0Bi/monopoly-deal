package main

import (
	"errors"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"monopoly-deal-backend/server"
)

func main() {
	hub := server.NewHub()
	defer hub.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.HandleConnections)

	staticDir := findStaticDir()
	if staticDir == "" {
		log.Println("Warning: frontend/dist not found — run `npm run build` in ./frontend")
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "frontend not built: run npm run build in ./frontend", http.StatusNotFound)
		})
	} else {
		log.Printf("Serving static files from %s", staticDir)
		mux.Handle("/", spaHandler(staticDir))
	}

	port := strings.TrimPrefix(envOr("PORT", "8080"), ":")
	addr := ":" + port

	log.Printf("Server listening on:")
	log.Printf("  -> Local:   http://localhost:%s (ws: ws://localhost:%s/ws)", port, port)
	for _, ip := range getLocalIPs() {
		log.Printf("  -> Network: http://%s:%s (ws: ws://%s:%s/ws)", ip, port, ip, port)
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       90 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal("ListenAndServe: ", err)
	}
}

func getLocalIPs() []string {
	var ips []string
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil
	}
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ip4 := ipnet.IP.To4(); ip4 != nil && !ip4.IsLinkLocalUnicast() {
				ips = append(ips, ip4.String())
			}
		}
	}
	return ips
}

func init() {
	// Go's table has no entry for this extension, which would leave the
	// installed-app manifest served as plain bytes.
	if err := mime.AddExtensionType(".webmanifest", "application/manifest+json"); err != nil {
		log.Printf("webmanifest mime: %v", err)
	}
}

// spaHandler serves static files and falls back to index.html for app routes.
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dir, filepath.Clean("/"+strings.TrimPrefix(r.URL.Path, "/")))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			// Asset names carry a content hash, so they can be cached hard.
			if strings.HasPrefix(r.URL.Path, "/assets/") || strings.HasPrefix(r.URL.Path, "/_expo/static/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			// A cached service worker is a version of the app that can never
			// replace itself, so this one file always comes from the server.
			if r.URL.Path == "/sw.js" {
				w.Header().Set("Cache-Control", "no-cache")
				w.Header().Set("Service-Worker-Allowed", "/")
			}
			fs.ServeHTTP(w, r)
			return
		}
		// index.html names the current bundle. Without this a browser is free
		// to reuse yesterday's copy, which points at a bundle that is gone —
		// a deploy nobody sees until they clear their cache.
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	})
}

func findStaticDir() string {
	candidates := []string{
		envOr("STATIC_DIR", ""),
		filepath.Join("..", "mobile-client", "dist"),
		filepath.Join("..", "frontend", "dist"),
		filepath.Join("frontend", "dist"),
		"dist",
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "index.html")); err == nil {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	return ""
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
