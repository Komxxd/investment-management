import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules\/(react|react-dom|react-router-dom|scheduler)\//,
              priority: 30,
            },
            {
              name: 'charts-vendor',
              test: /node_modules\/(recharts|d3-.*|victory-vendor)\//,
              priority: 25,
            },
            {
              name: 'dnd-vendor',
              test: /node_modules\/@dnd-kit\//,
              priority: 25,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules\/@supabase\//,
              priority: 25,
            },
          ],
        },
      },
    },
  },
})

