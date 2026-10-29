import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, ClipboardList, Clock, FileText, Target, UserX, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Attempt, Group, Material, MaterialView, Profile, Test } from '../../lib/types'
import { Card, ErrorBox, PageTitle, Spinner, Stat } from '../../components/ui'
import { fmtDate, fmtDuration, pct, scoreColor } from '../../lib/utils'

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(async () => {
    const [students, groups, materials, tests, attempts, views] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('groups').select('*').order('name'),
      supabase.from('materials').select('id,title,page_count'),
      supabase.from('tests').select('id,title'),
      supabase.from('attempts').select('id,test_id,user_id,started_at,finished_at,score,total,tab_switches').not('finished_at', 'is', null),
      supabase.from('material_views').select('user_id,material_id,seconds,pages,last_opened'),
    ])
    return {
      students: must(students) as Profile[],
      groups: must(groups) as Group[],
      materials: must(materials) as Material[],
      tests: must(tests) as Test[],
      attempts: must(attempts) as Attempt[],
      views: must(views) as MaterialView[],
    }
  })

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const { students, groups, materials, tests, attempts, views } = data
  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a.score, a.total), 0) / attempts.length) : 0
  const readSec = views.reduce((s, v) => s + v.seconds, 0)

  // Test üzrə orta nəticə
  const byTest = tests
    .map((t) => {
      const at = attempts.filter((a) => a.test_id === t.id)
      return { name: t.title.length > 18 ? t.title.slice(0, 18) + '…' : t.title, orta: at.length ? Math.round(at.reduce((s, a) => s + pct(a.score, a.total), 0) / at.length) : 0, say: at.length }
    })
    .filter((x) => x.say > 0)

  // Qrup üzrə müqayisə
  const byGroup = groups.map((g) => {
    const ids = new Set(students.filter((s) => s.group_id === g.id).map((s) => s.id))
    const at = attempts.filter((a) => ids.has(a.user_id))
    const rv = views.filter((v) => ids.has(v.user_id))
    return {
      name: g.name,
      orta: at.length ? Math.round(at.reduce((s, a) => s + pct(a.score, a.total), 0) / at.length) : 0,
      oxuma: Math.round(rv.reduce((s, v) => s + v.seconds, 0) / 60 / Math.max(1, ids.size)),
    }
  })

  // Son 14 gün aktivliyi
  const days: { gün: string; test: number; oxuma: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const next = d.getTime() + 86400000
    days.push({
      gün: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      test: attempts.filter((a) => { const t = new Date(a.finished_at!).getTime(); return t >= d.getTime() && t < next }).length,
      oxuma: views.filter((v) => { const t = new Date(v.last_opened).getTime(); return t >= d.getTime() && t < next }).length,
    })
  }

  // Aktiv olmayan tələbələr
  const active = new Set([...attempts.map((a) => a.user_id), ...views.map((v) => v.user_id)])
  const inactive = students.filter((s) => !active.has(s.id))
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name || '—'

  // Ən yaxşı tələbələr
  const ranking = students
    .map((s) => {
      const at = attempts.filter((a) => a.user_id === s.id)
      return { s, n: at.length, avg: at.length ? Math.round(at.reduce((x, a) => x + pct(a.score, a.total), 0) / at.length) : -1 }
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.avg - a.avg)

  const recent = [...attempts].sort((a, b) => b.finished_at!.localeCompare(a.finished_at!)).slice(0, 8)
  const name = (id: string) => students.find((s) => s.id === id)?.full_name || '—'
  const testTitle = (id: string) => tests.find((t) => t.id === id)?.title || '—'

  return (
    <div>
      <PageTitle title="İdarə paneli" subtitle="Ümumi statistika" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Tələbələr" value={students.length} sub={`${groups.length} qrup`} icon={<Users className="h-4 w-4" />} />
        <Stat label="Materiallar" value={materials.length} icon={<FileText className="h-4 w-4" />} />
        <Stat label="Testlər" value={tests.length} icon={<ClipboardList className="h-4 w-4" />} />
        <Stat label="Bitirilmiş cəhdlər" value={attempts.length} icon={<BookOpen className="h-4 w-4" />} />
        <Stat label="Orta nəticə" value={<span className={scoreColor(avg)}>{avg}%</span>} icon={<Target className="h-4 w-4" />} />
        <Stat label="Ümumi oxuma" value={fmtDuration(readSec)} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Son 14 günün aktivliyi</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="gün" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="test" name="Bitirilmiş testlər" stroke="#4f46e5" strokeWidth={2} />
              <Line type="monotone" dataKey="oxuma" name="Material açanlar" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Testlər üzrə orta nəticə (%)</h3>
          {byTest.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byTest}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="orta" name="Orta %" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-16 text-center text-sm text-slate-500">Hələ nəticə yoxdur</p>}
        </Card>
      </div>

      {byGroup.length > 0 && (
        <Card className="mb-6">
          <h3 className="mb-4 font-semibold text-slate-800">Qrupların müqayisəsi</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byGroup}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="orta" name="Orta test nəticəsi %" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="oxuma" name="Tələbə başına oxuma (dəq)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-semibold text-slate-800">Son nəticələr</h3>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-sm text-slate-500">Hələ yoxdur</p>}
            {recent.map((a) => (
              <Link key={a.id} to={`/a/attempt/${a.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{name(a.user_id)}</div>
                  <div className="truncate text-xs text-slate-500">{testTitle(a.test_id)} · {fmtDate(a.finished_at)}</div>
                </div>
                <span className={`font-semibold ${scoreColor(pct(a.score, a.total))}`}>{pct(a.score, a.total)}%</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold text-slate-800">Ən yüksək nəticələr</h3>
          <div className="space-y-2">
            {ranking.length === 0 && <p className="text-sm text-slate-500">Hələ yoxdur</p>}
            {ranking.slice(0, 8).map((r, i) => (
              <Link key={r.s.id} to={`/a/students/${r.s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className="w-5 text-center font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{r.s.full_name}</div>
                  <div className="text-xs text-slate-500">{groupName(r.s.group_id)} · {r.n} cəhd</div>
                </div>
                <span className={`font-semibold ${scoreColor(r.avg)}`}>{r.avg}%</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <UserX className="h-4 w-4 text-rose-500" /> Heç bir aktivliyi olmayanlar ({inactive.length})
          </h3>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {inactive.length === 0 && <p className="text-sm text-slate-500">Bütün tələbələr aktivdir 👍</p>}
            {inactive.map((s) => (
              <Link key={s.id} to={`/a/students/${s.id}`} className="flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className="text-slate-800">{s.full_name}</span>
                <span className="text-xs text-slate-500">{groupName(s.group_id)}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
