// Vite config — Vite is the dev server + bundler that runs the app.
// - @vitejs/plugin-react  : lets Vite understand JSX and enables fast refresh
// - @tailwindcss/vite     : compiles Tailwind utility classes on the fly
// - vite-plugin-singlefile: (single-file modes only) inlines ALL JS/CSS
//   into one index.html so the app can ship as a self-contained page
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Both single-file modes inline everything into one index.html:
    //   'artifact'   — a fragment for a sandboxed artifact host, with
    //                  the network features switched off
    //   'standalone' — a complete page you can double-click or upload
    //                  anywhere. Keeps PROD behaviour, so cloud sync and
    //                  the assistant still work when served over https.
    ...(mode === 'artifact' || mode === 'standalone' ? [viteSingleFile()] : []),
  ],
  server: {
    port: 5173,
    strictPort: true, // fail instead of silently picking another port
  },
}))
