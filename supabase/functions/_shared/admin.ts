export function authorizeAdmin(request: Request): Response | null {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) return Response.json({ error: 'Service is not configured' }, { status: 500 })
  if (request.headers.get('Authorization') !== `Bearer ${key}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
