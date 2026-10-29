import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button, ErrorBox, Field, Input, Spinner } from '../components/ui'

export default function Login() {
  const { session, profile, loading, signIn } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (session && profile) return <Navigate to={profile.role === 'admin' ? '/a' : '/s'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn(login, password)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-2xl bg-indigo-600 p-3 text-white"><GraduationCap className="h-8 w-8" /></div>
          <h1 className="text-xl font-bold text-slate-900">İnformatika platforması</h1>
          <p className="mt-1 text-sm text-slate-500">Hesabınıza daxil olun</p>
        </div>
        <div className="space-y-4">
          <Field label="Login">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ali.mammadov" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Şifrə">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {err && <ErrorBox>{err}</ErrorBox>}
          <Button type="submit" loading={busy} className="w-full">Daxil ol</Button>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Login və şifrəni müəlliminizdən alın</p>
      </form>
    </div>
  )
}
