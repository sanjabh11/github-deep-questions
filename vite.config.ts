import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/proxy/serpapi': {
        target: 'https://serpapi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/serpapi/, '/search'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('SerpAPI proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending SerpAPI Request:', req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received SerpAPI Response:', req.url, 'Status:', proxyRes.statusCode);
          });
        }
      },
      '/api/proxy/openrouter': {
        target: 'https://openrouter.ai/api/v1',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/openrouter/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('OpenRouter proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending OpenRouter Request:', req.url);
            const authHeader = req.headers['authorization'];
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader);
              proxyReq.setHeader('HTTP-Referer', 'http://localhost:8080');
              proxyReq.setHeader('X-Title', 'GitHub Deep Questions');
              proxyReq.setHeader('Content-Type', 'application/json');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received OpenRouter Response:', req.url, 'Status:', proxyRes.statusCode);
          });
        }
      },
      '/api/proxy/gemini': {
        target: 'https://generativelanguage.googleapis.com/v1beta',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/gemini/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Gemini proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Gemini Request:', req.url);
            const apiKeyHeader = req.headers['x-goog-api-key'];
            if (apiKeyHeader) {
              proxyReq.setHeader('x-goog-api-key', apiKeyHeader);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Gemini Response:', req.url, 'Status:', proxyRes.statusCode);
          });
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
