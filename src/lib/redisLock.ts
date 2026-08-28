import type Redis from 'ioredis'

let redisClient: Redis | null = null

function getRedisClient() {
  if (redisClient) return redisClient
  // try environment vars via globalThis or import.meta
  const url = (globalThis as any).process?.env?.REDIS_URL || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_REDIS_URL)
  if (!url) return null
  // Lazy import to avoid bundling in browser
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedis = require('ioredis')
  redisClient = new IORedis(url)
  return redisClient
}

export async function acquireLock(key: string, ttl = 30_000): Promise<string | null> {
  const client = getRedisClient()
  if (!client) return null
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ok = await client.set(key, token, 'PX', ttl, 'NX')
  return ok === 'OK' ? token : null
}

export async function releaseLock(key: string, token: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  // Lua script to release only if value matches
  const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
  try {
    const res = await client.eval(script, 1, key, token)
    return res === 1
  } catch {
    return false
  }
}

export async function isLocked(key: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  const v = await client.get(key)
  return !!v
}
