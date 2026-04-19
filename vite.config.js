import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import {
  createReadStream,
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRAMES_SRC = resolve(__dirname, 'lily_morphs_handoff/frames')
const URL_PREFIX = '/lily_morphs/'

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name)
    const d = join(dest, entry.name)
    if (entry.isDirectory()) copyDirRecursive(s, d)
    else if (entry.isFile()) copyFileSync(s, d)
  }
}

// Serves the morph frame bundle from lily_morphs_handoff/frames/ at
// /lily_morphs/* in dev, and copies it into dist/lily_morphs/ on build so
// the same URLs work in production without duplicating the ~18 MB on disk
// in the repo.
function lilyMorphFrames() {
  return {
    name: 'lily-morph-frames',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(URL_PREFIX)) return next()
        const rel = decodeURIComponent(req.url.slice(URL_PREFIX.length).split('?')[0])
        if (!rel || rel.includes('..')) return next()
        const file = join(FRAMES_SRC, rel)
        if (!existsSync(file) || !statSync(file).isFile()) return next()
        const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (!existsSync(FRAMES_SRC)) return
      const outDir = resolve(__dirname, 'dist/lily_morphs')
      copyDirRecursive(FRAMES_SRC, outDir)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lilyMorphFrames()],
})
