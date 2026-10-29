import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, KeyRound, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react'
import { adminUsers, supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Group, Profile } from '../../lib/types'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageTitle, Select, Spinner, Table, Td } from '../../components/ui'
import { downloadStudentTemplate, exportXlsx, fmtDate, pick, readSheet, suggestLogin } from '../../lib/utils'

type Row = { full_name: string; login: string; password?: string; group?: string }
type Result = Row & { ok: boolean; error?: string }

export default function AdminStudents() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, g] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('groups').select('*').order('name'),
    ])
    return { students: must(p) as Profile[], groups: must(g) as Group[] }
  })

  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [msg, setMsg] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const s = q.trim().toLowerCase()
    return data.students.filter(
      (x) => (!groupFilter || x.group_id === groupFilter) && (!s || x.full_name.toLowerCase().includes(s) || x.login.includes(s)),
    )
  }, [data, q, groupFilter])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>
  const gName = (id: string | null) => data.groups.find((g) => g.id === id)?.name

  const changeGroup = async (s: Profile, group_id: string) => {
    await supabase.from('profiles').update({ group_id: group_id || null }).eq('id', s.id)
    reload()
  }

  const resetPassword = async (s: Profile) => {
    if (!confirm(`${s.full_name} üçün yeni şifrə yaradılsın?`)) return
    try {
      const r = await adminUsers<{ password: string }>({ action: 'reset_password', user_id: s.id })
      setResults([{ full_name: s.full_name, login: s.login, password: r.password, group: gName(s.group_id), ok: true }])
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  const remove = async (s: Profile) => {
    if (!confirm(`${s.full_name} silinsin? Bütün nəticələri də silinəcək.`)) return
    try {
      await adminUsers({ action: 'delete', user_id: s.id })
      reload()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  const exportList = () =>
    exportXlsx(
      filtered.map((s) => ({ 'Ad Soyad': s.full_name, Login: s.login, Qrup: gName(s.group_id) || '', 'Yaradılıb': fmtDate(s.created_at) })),
      'tələbələr.xlsx',
    )

  return (
    <div>
      <PageTitle
        title="Tələbələr"
        subtitle={`${data.students.length} tələbə, ${data.groups.length} qrup`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setGroupsOpen(true)}>Qruplar</Button>
            <Button variant="secondary" onClick={exportList}><Download className="h-4 w-4" /> Excel</Button>
            <Button variant="secondary" onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Bir tələbə</Button>
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Excel-dən yüklə</Button>
          </>
        }
      />
      {msg && <div className="mb-4"><ErrorBox>{msg}</ErrorBox></div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Ad və ya login ilə axtar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-48" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">Bütün qruplar</option>
          {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>

      <Table head={['Ad Soyad', 'Login', 'Qrup', 'Yaradılıb', '']} empty={filtered.length === 0}>
        {filtered.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <Td><Link to={`/a/students/${s.id}`} className="font-medium text-indigo-700 hover:underline">{s.full_name}</Link></Td>
            <Td className="font-mono text-xs">{s.login}</Td>
            <Td>
              <Select className="w-36 py-1" value={s.group_id || ''} onChange={(e) => changeGroup(s, e.target.value)}>
                <option value="">— qrupsuz —</option>
                {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Td>
            <Td className="text-xs text-slate-500">{fmtDate(s.created_at)}</Td>
            <Td className="text-right whitespace-nowrap">
              <Button variant="ghost" size="sm" onClick={() => resetPassword(s)} title="Şifrəni yenilə"><KeyRound className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => remove(s)} title="Sil"><Trash2 className="h-4 w-4 text-rose-600" /></Button>
            </Td>
          </tr>
        ))}
      </Table>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={(r) => { setResults(r); setImportOpen(false); reload() }} />
      <AddModal open={addOpen} groups={data.groups} onClose={() => setAddOpen(false)} onDone={(r) => { setResults(r); setAddOpen(false); reload() }} />
      <GroupsModal open={groupsOpen} groups={data.groups} students={data.students} onClose={() => setGroupsOpen(false)} onChange={reload} />
      <ResultsModal results={results} onClose={() => setResults(null)} />
    </div>
  )
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (r: Result[]) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onFile = async (f?: File) => {
    if (!f) return
    setErr('')
    try {
      const raw = await readSheet(f)
      const parsed = raw
        .map((r) => {
          const full_name = pick(r, 'Ad Soyad', 'Ad', 'Tələbə', 'Name')
          return {
            full_name,
            login: (pick(r, 'Login', 'İstifadəçi adı') || suggestLogin(full_name)).toLowerCase(),
            password: pick(r, 'Şifrə', 'Sifre', 'Password'),
            group: pick(r, 'Qrup', 'Group'),
          }
        })
        .filter((r) => r.full_name)
      if (!parsed.length) throw new Error('Faylda "Ad Soyad" sütunu tapılmadı və ya boşdur')
      setRows(parsed)
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      const all: Result[] = []
      for (let i = 0; i < rows.length; i += 50) {
        const r = await adminUsers<{ results: Result[] }>({ action: 'create', students: rows.slice(i, i + 50) })
        all.push(...r.results)
      }
      setRows([])
      onDone(all)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tələbələri Excel-dən yüklə" wide>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Sütunlar: <b>Ad Soyad</b>, <b>Login</b>, <b>Şifrə</b>, <b>Qrup</b>. Login boş olsa addan yaradılır, şifrə boş olsa təsadüfi şifrə verilir.
          Olmayan qruplar avtomatik yaradılır.
          <button onClick={downloadStudentTemplate} className="ml-1 font-medium text-indigo-600 underline cursor-pointer">Nümunə faylı yüklə</button>
        </div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700" />
        {err && <ErrorBox>{err}</ErrorBox>}
        {rows.length > 0 && (
          <>
            <div className="max-h-72 overflow-y-auto">
              <Table head={['#', 'Ad Soyad', 'Login', 'Şifrə', 'Qrup']}>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <Td className="text-slate-400">{i + 1}</Td>
                    <Td>{r.full_name}</Td>
                    <Td className="font-mono text-xs">{r.login}</Td>
                    <Td className="text-xs">{r.password ? '••••••' : <span className="text-slate-400">avtomatik</span>}</Td>
                    <Td>{r.group || '—'}</Td>
                  </tr>
                ))}
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRows([])}>Təmizlə</Button>
              <Button onClick={go} loading={busy}>{rows.length} hesab yarat</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function AddModal({ open, groups, onClose, onDone }: { open: boolean; groups: Group[]; onClose: () => void; onDone: (r: Result[]) => void }) {
  const [full_name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [group, setGroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      const r = await adminUsers<{ results: Result[] }>({ action: 'create', students: [{ full_name, login: login || suggestLogin(full_name), password, group }] })
      if (!r.results[0]?.ok) throw new Error(r.results[0]?.error || 'Xəta')
      setName(''); setLogin(''); setPassword('')
      onDone(r.results)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni tələbə">
      <div className="space-y-3">
        <Field label="Ad Soyad"><Input value={full_name} onChange={(e) => setName(e.target.value)} placeholder="Əli Məmmədov" /></Field>
        <Field label="Login" hint="Boş qalsa addan yaradılacaq"><Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder={suggestLogin(full_name) || 'ali.mammadov'} /></Field>
        <Field label="Şifrə" hint="Boş qalsa təsadüfi şifrə yaradılacaq"><Input value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Qrup">
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">— seçin —</option>
            {groups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
          </Select>
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex justify-end"><Button onClick={go} loading={busy} disabled={!full_name.trim()}>Yarat</Button></div>
      </div>
    </Modal>
  )
}

function GroupsModal({ open, groups, students, onClose, onChange }: { open: boolean; groups: Group[]; students: Profile[]; onClose: () => void; onChange: () => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const add = async () => {
    setErr('')
    const { error } = await supabase.from('groups').insert({ name: name.trim() })
    if (error) return setErr(error.message.includes('duplicate') ? 'Bu adda qrup artıq var' : error.message)
    setName('')
    onChange()
  }
  const del = async (g: Group) => {
    if (!confirm(`"${g.name}" qrupu silinsin? Tələbələr silinmir, sadəcə qrupsuz qalır.`)) return
    await supabase.from('groups').delete().eq('id', g.id)
    onChange()
  }
  return (
    <Modal open={open} onClose={onClose} title="Qruplar">
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs: 758 TH" onKeyDown={(e) => e.key === 'Enter' && name.trim() && add()} />
        <Button onClick={add} disabled={!name.trim()}><Plus className="h-4 w-4" /> Əlavə et</Button>
      </div>
      {err && <div className="mb-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="space-y-1">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
            <span className="font-medium text-slate-800">{g.name}</span>
            <div className="flex items-center gap-2">
              <Badge>{students.filter((s) => s.group_id === g.id).length} tələbə</Badge>
              <Button variant="ghost" size="sm" onClick={() => del(g)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-slate-500">Hələ qrup yoxdur</p>}
      </div>
    </Modal>
  )
}

function ResultsModal({ results, onClose }: { results: Result[] | null; onClose: () => void }) {
  if (!results) return null
  const ok = results.filter((r) => r.ok)
  const bad = results.filter((r) => !r.ok)
  return (
    <Modal open onClose={onClose} title="Hesab məlumatları" wide>
      <Card className="mb-4 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Şifrələr yalnız indi göstərilir. Excel faylını yükləyib saxlayın və tələbələrə paylayın.
      </Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-600"><b className="text-emerald-600">{ok.length}</b> uğurlu, <b className="text-rose-600">{bad.length}</b> xəta</span>
        {ok.length > 0 && (
          <Button onClick={() => exportXlsx(ok.map((r) => ({ 'Ad Soyad': r.full_name, Qrup: r.group || '', Login: r.login, Şifrə: r.password })), 'giriş-məlumatları.xlsx')}>
            <Download className="h-4 w-4" /> Excel kimi yüklə
          </Button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        <Table head={['Ad Soyad', 'Login', 'Şifrə', 'Status']}>
          {results.map((r, i) => (
            <tr key={i}>
              <Td>{r.full_name}</Td>
              <Td className="font-mono text-xs">{r.login}</Td>
              <Td className="font-mono text-xs">{r.password || '—'}</Td>
              <Td>{r.ok ? <Badge color="green">Hazır</Badge> : <span className="text-xs text-rose-600">{r.error}</span>}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </Modal>
  )
}
