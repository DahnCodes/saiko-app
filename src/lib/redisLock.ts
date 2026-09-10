import type Redis from 'ioredis'

let redisClient: Redis | null = null

async function getRedisClient() {
  if (typeof window !== 'undefined') return null
  if (redisClient) return redisClient
  const url = process.env.REDIS_URL
  if (!url) return null
  const { default: IORedis } = await import('ioredis')
  redisClient = new IORedis(url)
  return redisClient
}

export async function acquireLock(key: string, ttl = 30_000): Promise<string | null> {
  const client = await getRedisClient()
  if (!client) return null
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ok = await client.set(key, token, 'PX', ttl, 'NX')
  return ok === 'OK' ? token : null
}

export async function releaseLock(key: string, token: string): Promise<boolean> {
  const client = await getRedisClient()
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
  const client = await getRedisClient()
  if (!client) return false
  const v = await client.get(key)
  return !!v
}
