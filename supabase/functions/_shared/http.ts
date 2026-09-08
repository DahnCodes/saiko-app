export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Log controlled metadata only; never tokens, headers, or upstream response bodies.
export function log(scope: string, event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ function: scope, event, ...fields }))
}
