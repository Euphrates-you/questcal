// ============================================================
// Builds ONE self-contained file: dist/QuestCal.html
//
// Everything is inlined — JS, CSS, fonts, and the app icon — so the
// file works with no server and no internet connection at all. You can
// double-click it, email it, put it in Dropbox, or upload it to any
// website and it just runs.
//
// Two deliberate differences from the artifact build:
//  - the full <!doctype>/<html>/<head>/<body> document is kept, so
//    it's a real page rather than a fragment for some host to wrap
//  - it builds in PROD (not artifact) mode, so cloud sync AND the
//    System Assistant still work when the file is served over https.
//    From file:// the browser blocks those cross-origin requests;
//    the app handles that and falls back to local storage cleanly.
//
// Run via: npm run build:standalone
// ============================================================
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let html = await readFile(join(root, 'dist/index.html'), 'utf8')
const fonts = await readFile(join(root, 'scripts/artifact-fonts.css'), 'utf8')
const icon = await readFile(join(root, 'public/icons/icon-192.png'))
const iconUri = `data:image/png;base64,${icon.toString('base64')}`

html = html
  // Google Fonts can't be reached offline — the embedded copies go in below.
  .replace(/<link[^>]*rel="preconnect"[^>]*>/gi, '')
  .replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/gi, '')
  // No manifest file sits beside a single loose .html, so drop the link
  // rather than leave a guaranteed 404. (Installing as an app is the
  // hosted version's job — see the README.)
  .replace(/<link[^>]*rel="manifest"[^>]*>/gi, '')
  // Inline the icon so the tab and home-screen icon work from anywhere.
  .replace(/<link([^>]*)rel="(icon|apple-touch-icon)"([^>]*)>/gi,
    (m, a, rel) => `<link rel="${rel}" href="${iconUri}" />`)

// Embedded fonts first, so every later style can use them.
html = html.replace(/<\/head>/i, `<style>\n${fonts}</style>\n</head>`)

await writeFile(join(root, 'dist/QuestCal.html'), html)
console.log(`dist/QuestCal.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
