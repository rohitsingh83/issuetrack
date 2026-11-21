var _a, _b;
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        allowedHosts: true,
        proxy: {
            // The dev proxy stands in for a reverse proxy: the browser talks to the
            // Vite origin, so the request reaches the API without a foreign Origin
            // header (otherwise hosted previews on https://<host>.e2b.app would be
            // rejected by CORS). Cookies stay first-party.
            '/api': {
                target: (_a = process.env.VITE_PROXY_TARGET) !== null && _a !== void 0 ? _a : 'http://localhost:4000',
                changeOrigin: false,
                configure: function (proxy) {
                    proxy.on('proxyReq', function (proxyReq) { return proxyReq.removeHeader('origin'); });
                },
            },
            '/socket.io': {
                target: (_b = process.env.VITE_PROXY_TARGET) !== null && _b !== void 0 ? _b : 'http://localhost:4000',
                ws: true,
                changeOrigin: false,
                configure: function (proxy) {
                    proxy.on('proxyReq', function (proxyReq) { return proxyReq.removeHeader('origin'); });
                },
            },
        },
    },
    preview: {
        host: '0.0.0.0',
        port: 4173,
        allowedHosts: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 900,
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: false,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        restoreMocks: true,
    },
});
