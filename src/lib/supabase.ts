import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)
export const supabase = createClient(url || 'http://localhost', key || 'anon')

export const LOGIN_DOMAIN = ((import.meta.env.VITE_LOGIN_DOMAIN as string) || 'telebe.oyu.az').toLowerCase()

export function loginToEmail(login: string) {
  const l = login.trim().toLowerCase()
  return l.includes('@') ? l : `${l}@${LOGIN_DOMAIN}`
}

/** Admin funksiyasını çağırır (Netlify Function) */
export async function adminUsers<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/.netlify/functions/admin-users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  let out: any = null
  try {
    out = await res.json()
  } catch {
    throw new Error('Server funksiyası cavab vermədi. Saytı Netlify-da (və ya "netlify dev" ilə) açdığınızdan əmin olun.')
  }
  if (!res.ok) throw new Error(out?.error || 'Xəta baş verdi')
  return out as T
}
