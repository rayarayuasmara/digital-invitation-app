// Copies the pages that intentionally stay vanilla into the Vite output:
// the marketing landing page at `/` and the public guest invitation.
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const dist = path.resolve(here, '../dist')

const pages = [
  ['index.html', 'index.html'],
  ['invitation.html', 'invitation.html'],
]

for (const [from, to] of pages) {
  const source = path.join(root, from)
  if (!existsSync(source)) throw new Error(`Missing static page: ${source}`)
  copyFileSync(source, path.join(dist, to))
  console.log(`copied ${from} -> dist/${to}`)
}
