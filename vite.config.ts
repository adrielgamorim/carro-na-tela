import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { proxyTokensFromEnv } from './server/fipe-proxy.ts'
import { fipeProxyPlugin } from './server/vite-plugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-side only: variables without the VITE_ prefix never reach the bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const tokens = proxyTokensFromEnv(env)

  return {
    plugins: [react(), fipeProxyPlugin({ tokens })],
  }
})
