import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

export function loadModule(entry, { fetch, db, env = {}, storage, publicRequest, mocks = {}, globals = {} } = {}) {
  const cache = new Map()
  const logs = []
  const context = vm.createContext({
    ...globals, Response, Request, Headers, URLSearchParams, AbortSignal, crypto, Error, DOMException, setTimeout, clearTimeout,
    fetch: fetch ?? (() => { throw new Error('Unexpected network request') }),
    Deno: { serve() {}, env: { get: key => env[key] } },
    localStorage: storage ?? { getItem: () => null, setItem() {} },
    __env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-anon-key' },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args), info: (...args) => logs.push(args) },
    ...globals,
  })
  function load(file) {
    file = path.resolve(file)
    if (!fs.existsSync(file)) file = fs.existsSync(file + '.ts') ? file + '.ts' : path.join(file, 'index.ts')
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.ts')
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', 'globalThis.__env')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
    const require = specifier => {
      if (specifier in mocks) return mocks[specifier]
      if (specifier.startsWith('https://esm.sh/')) return { createClient: () => db }
      if (specifier.includes('lib/supabase')) return { supabase: { auth: { getSession() { throw new Error('Auth must not be consulted') } } } }
      if (publicRequest && specifier.endsWith('publicAnimeRequest.ts')) return { publicAnimeRequest: publicRequest }
      return load(path.resolve(path.dirname(file), specifier))
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(require, module, module.exports)
    return module.exports
  }
  return { ...load(entry), logs }
}
