import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true
      },
      '^/app/ksu-smart-maintain/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/app\/ksu-smart-maintain/, '')
      },
      '^/app/ksu-smart-maintain/uploads': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/app\/ksu-smart-maintain/, '')
      }
    }
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true
      },
      '^/app/ksu-smart-maintain/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/app\/ksu-smart-maintain/, '')
      },
      '^/app/ksu-smart-maintain/uploads': {
        target: process.env.BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/app\/ksu-smart-maintain/, '')
      }
    }
  }
})
