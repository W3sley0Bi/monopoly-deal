package main

import (
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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

	addr := ":" + envOr("PORT", "8080")

	// Browsers only grant camera and microphone access on a secure origin, so
	// voice and video need HTTPS unless everyone is playing on localhost.
	cert, key := os.Getenv("CERT_FILE"), os.Getenv("KEY_FILE")
	if cert != "" && key != "" {
		log.Printf("Server listening on https://localhost%s (wss at %s/ws)", addr, addr)
		if err := http.ListenAndServeTLS(addr, cert, key, mux); err != nil {
			log.Fatal("ListenAndServeTLS: ", err)
		}
		return
	}

	log.Printf("Server listening on %s (ws at %s/ws)", addr, addr)
	log.Println("No CERT_FILE/KEY_FILE set: camera and microphone will only work on localhost. See README.")
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
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
			if strings.HasPrefix(r.URL.Path, "/assets/") {
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
