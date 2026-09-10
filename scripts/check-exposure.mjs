// Scan Git's current file set plus eligible untracked files; never print secret values.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean))]
const findings = []
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['provider secret', /(?:sb_secret_|ghp_|github_pat_|sk_live_|sk-proj-)[A-Za-z0-9_-]{16,}/g],
  ['JWT', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
]
for (const file of files) {
  if ((path.basename(file).startsWith('.env') && path.basename(file) !== '.env.example') || /^(supabase\/\.(temp|branches)\/|node_modules\/|dist\/)/.test(file)) findings.push([file, 'private/local file is eligible for Git'])
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue
  const content = fs.readFileSync(file, 'utf8')
  for (const [kind, pattern] of patterns) for (const match of content.matchAll(pattern)) {
    if (kind === 'JWT') {
      try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()).role === 'anon') continue } catch { /* Unknown JWTs need review. */ }
    }
    findings.push([file, kind])
  }
  const exposedNames = content.match(/\bVITE_[A-Z][A-Z0-9_]*\b/g) ?? []
  if (exposedNames.some(name => /REDIS|SERVICE_ROLE|PASSWORD|PRIVATE_KEY/.test(name))) findings.push([file, 'server credential uses a browser-exposed variable name'])
}
for (const [file, kind] of findings) console.error(`${file}: ${kind}`)
console.log(`Exposure check: ${files.length} files scanned, ${findings.length} findings. Heuristic scan; not a guarantee.`)
process.exitCode = findings.length ? 1 : 0
