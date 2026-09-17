package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

// Injected at build time via -ldflags
var (
	AppVersion = "dev"
	BuildTime  = "unknown"
)

//go:embed all:dist
var distFS embed.FS

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

func main() {
	// 1. Version Flag Handling
	if len(os.Args) > 1 {
		arg := strings.ToLower(os.Args[1])
		if arg == "--version" || arg == "-v" || arg == "version" {
			fmt.Printf("SLR Viewer %s (Build Time: %s)\n", AppVersion, BuildTime)
			os.Exit(0)
		}
	}

	// 2. Snapshot CLI Argument Handling
	var snapshotBytes []byte
	var snapshotFilename string
	var hasSnapshot bool

	if len(os.Args) > 1 && !strings.HasPrefix(os.Args[1], "-") {
		candidatePath := os.Args[1]
		if absPath, err := filepath.Abs(candidatePath); err == nil {
			if data, err := os.ReadFile(absPath); err == nil {
				snapshotBytes = data
				snapshotFilename = filepath.Base(absPath)
				hasSnapshot = true
				log.Printf("Loaded input snapshot from CLI: %s (%d bytes)", snapshotFilename, len(data))
			} else {
				log.Printf("Warning: Unable to read file at %s: %v", candidatePath, err)
			}
		}
	}

	// 3. Dynamic Local Port Binding (Zero Port Collisions)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("Fatal: Failed to bind to dynamic loopback port: %v", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port

	// 4. Heartbeat & Shutdown State (Terminate upon beacon shutdown or 60s idle heartbeat loss)
	var lastHeartbeat int64
	atomic.StoreInt64(&lastHeartbeat, time.Now().Unix())

	http.HandleFunc("/api/heartbeat", func(w http.ResponseWriter, r *http.Request) {
		atomic.StoreInt64(&lastHeartbeat, time.Now().Unix())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	http.HandleFunc("/api/shutdown", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"shutting_down"}`))
		go func() {
			time.Sleep(500 * time.Millisecond)
			log.Println("Browser session closed (shutdown beacon received). Terminating SLR Viewer...")
			os.Exit(0)
		}()
	})

	// 5. Serve Snapshot API if loaded via CLI/Drag-Drop (Always registered to prevent SPA fallback to index.html)
	snapshotHandler := func(w http.ResponseWriter, r *http.Request) {
		if !hasSnapshot {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":"No snapshot loaded via CLI"}`))
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", snapshotFilename))
		w.WriteHeader(http.StatusOK)
		w.Write(snapshotBytes)
	}
	http.HandleFunc("/api/snapshot", snapshotHandler)
	http.HandleFunc("/initial-snapshot", snapshotHandler)

	// 6. Embedded Static Asset Server
	subFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		log.Fatalf("Fatal: Failed to mount embedded dist filesystem: %v", err)
	}

	fileServer := http.FileServer(http.FS(subFS))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Single Page App fallback: if not an API and path doesn't exist, let index.html handle routing
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" && !strings.HasPrefix(path, "api/") && path != "initial-snapshot" {
			if _, err := subFS.Open(path); err != nil {
				r.URL.Path = "/"
			}
		}
		fileServer.ServeHTTP(w, r)
	})

	// 7. Background Heartbeat Monitor
	go func() {
		// Grace period: allow 30 seconds for browser launch and initial assets load
		time.Sleep(30 * time.Second)
		for {
			time.Sleep(2 * time.Second)
			last := atomic.LoadInt64(&lastHeartbeat)
			if time.Now().Unix()-last > 60 {
				log.Println("Browser session closed (heartbeat timeout). Auto-terminating SLR Viewer...")
				os.Exit(0)
			}
		}
	}()

	// 8. Launch Browser
	var targetURL string
	if hasSnapshot {
		targetURL = fmt.Sprintf("http://127.0.0.1:%d/?autoload=initial-snapshot", port)
	} else {
		targetURL = fmt.Sprintf("http://127.0.0.1:%d/", port)
	}

	log.Printf("=========================================================")
	log.Printf(" SLR Viewer %s Running", AppVersion)
	log.Printf(" Local Web Server: http://127.0.0.1:%d", port)
	log.Printf(" Press Ctrl+C or close browser window to terminate.")
	log.Printf("=========================================================")

	go func() {
		time.Sleep(250 * time.Millisecond)
		if err := openBrowser(targetURL); err != nil {
			log.Printf("Notice: Please open your browser manually at %s", targetURL)
		}
	}()

	// 9. Start Serving
	server := &http.Server{}
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server stopped with error: %v", err)
	}
}
