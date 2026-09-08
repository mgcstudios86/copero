import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const execFileAsync = promisify(execFile)
const STATIC_SEO_SCRIPTS = [
  'scripts/prerender.mjs',
  'scripts/patch-build-career-locales.mjs',
  'scripts/prerender-simulador-carrera-futbol.mjs',
  'scripts/prerender-career-modes.mjs',
  'scripts/patch-contact-prerender.mjs',
  'scripts/patch-language-availability.mjs',
  'scripts/promote-default-locale.mjs',
]

type WranglerConfig = { vars?: { VITE_GA_MEASUREMENT_ID?: string; VITE_CLARITY_PROJECT_ID?: string } }
function readWranglerPublicVars(): WranglerConfig['vars'] { const raw = readFileSync(new URL('./wrangler.jsonc', import.meta.url), 'utf8'); return (JSON.parse(raw) as WranglerConfig).vars ?? {} }
function staticSeoBuildPlugin(): Plugin { return { name: 'copero-static-seo-build', apply: 'build', async closeBundle() { for (const script of STATIC_SEO_SCRIPTS) { const { stdout, stderr } = await execFileAsync(process.execPath, [script], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }); if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr) } } } }
export default defineConfig(({ mode }) => { const buildEnv = loadEnv(mode, process.cwd(), 'VITE_'); const wranglerVars = readWranglerPublicVars(); const gaMeasurementId = buildEnv.VITE_GA_MEASUREMENT_ID || wranglerVars?.VITE_GA_MEASUREMENT_ID || ''; const clarityProjectId = buildEnv.VITE_CLARITY_PROJECT_ID || wranglerVars?.VITE_CLARITY_PROJECT_ID || ''; return { plugins: [react(), tailwindcss(), staticSeoBuildPlugin()], define: { 'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(gaMeasurementId), 'import.meta.env.VITE_CLARITY_PROJECT_ID': JSON.stringify(clarityProjectId) } } })
