import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev convenience: call backend via same-origin /api
      '/api': 'http://localhost:5000',
    },
  },
})
