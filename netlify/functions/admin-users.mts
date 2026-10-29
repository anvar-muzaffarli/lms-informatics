// Tələbə hesablarını yaradan / şifrə yeniləyən / silən server funksiyası.
// Service role açarı yalnız burada istifadə olunur və brauzerə heç vaxt getmir.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DOMAIN = (process.env.VITE_LOGIN_DOMAIN || 'telebe.oyu.az').toLowerCase()

type StudentInput = { full_name: string; login: string; password?: string; group?: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
function randomPassword(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function normalizeLogin(s: string) {
  return s.trim().toLowerCase()
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Yalnız POST' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Serverdə SUPABASE_SERVICE_ROLE_KEY və ya VITE_SUPABASE_URL təyin edilməyib' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  // Sorğunu göndərənin admin olduğunu yoxla
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Giriş tələb olunur' }, 401)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Sessiya etibarsızdır' }, 401)
  const { data: me } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
  if (me?.role !== 'admin') return json({ error: 'Bu əməliyyat yalnız admin üçündür' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Yanlış sorğu' }, 400)
  }

  if (body.action === 'create') {
    const students: StudentInput[] = Array.isArray(body.students) ? body.students.slice(0, 500) : []
    const { data: groups } = await admin.from('groups').select('id,name')
    const groupMap = new Map<string, string>((groups || []).map((g) => [g.name.trim().toLowerCase(), g.id]))

    const results: { login: string; full_name: string; password?: string; group?: string; ok: boolean; error?: string }[] = []

    for (const s of students) {
      const login = normalizeLogin(s.login || '')
      const full_name = (s.full_name || '').trim()
      const groupName = (s.group || '').trim()
      if (!login || !/^[a-z0-9._-]{3,40}$/.test(login)) {
        results.push({ login, full_name, ok: false, error: 'Login yalnız latın hərfləri, rəqəm, nöqtə, tire ola bilər (3-40 simvol)' })
        continue
      }
      if (!full_name) {
        results.push({ login, full_name, ok: false, error: 'Ad Soyad boşdur' })
        continue
      }

      let group_id: string | null = null
      if (groupName) {
        const key = groupName.toLowerCase()
        group_id = groupMap.get(key) || null
        if (!group_id) {
          const { data: g, error: gErr } = await admin.from('groups').insert({ name: groupName }).select('id').single()
          if (gErr || !g) {
            results.push({ login, full_name, ok: false, error: 'Qrup yaradıla bilmədi' })
            continue
          }
          group_id = g.id
          groupMap.set(key, g.id)
        }
      }

      const password = (s.password || '').trim() || randomPassword()
      if (password.length < 6) {
        results.push({ login, full_name, ok: false, error: 'Şifrə ən azı 6 simvol olmalıdır' })
        continue
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: `${login}@${DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { full_name, login },
      })
      if (cErr || !created.user) {
        const msg = cErr?.message?.includes('already') ? 'Bu login artıq mövcuddur' : cErr?.message || 'Xəta'
        results.push({ login, full_name, ok: false, error: msg })
        continue
      }

      const { error: pErr } = await admin
        .from('profiles')
        .insert({ id: created.user.id, full_name, login, role: 'student', group_id })
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id)
        results.push({ login, full_name, ok: false, error: pErr.message.includes('duplicate') ? 'Bu login artıq mövcuddur' : pErr.message })
        continue
      }
      results.push({ login, full_name, password, group: groupName, ok: true })
    }
    return json({ results })
  }

  if (body.action === 'reset_password') {
    const password = (body.password || '').trim() || randomPassword()
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password })
    if (error) return json({ error: error.message }, 400)
    return json({ password })
  }

  if (body.action === 'delete') {
    if (body.user_id === userData.user.id) return json({ error: 'Öz hesabınızı silə bilməzsiniz' }, 400)
    const { error } = await admin.auth.admin.deleteUser(body.user_id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Naməlum əməliyyat' }, 400)
}
