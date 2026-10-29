import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Attempt, Group, Material, MaterialView, Profile, Test } from '../../lib/types'
import { Badge, Card, ErrorBox, PageTitle, Progress, Spinner, Stat, Table, Td } from '../../components/ui'
import { fmtDate, fmtDuration, pct, scoreColor } from '../../lib/utils'

export default function AdminStudentDetail() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(async () => {
    const profile = must(await supabase.from('profiles').select('*').eq('id', id!).single()) as Profile
    const [group, mg, views, attempts, tests] = await Promise.all([
      profile.group_id ? supabase.from('groups').select('*').eq('id', profile.group_id).single() : Promise.resolve({ data: null, error: null }),
      profile.group_id
        ? supabase.from('material_groups').select('materials(*)').eq('group_id', profile.group_id)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('material_views').select('*').eq('user_id', id!),
      supabase.from('attempts').select('*').eq('user_id', id!).order('started_at', { ascending: false }),
      supabase.from('tests').select('id,title'),
    ])
    return {
      profile,
      group: group.data as Group | null,
      materials: ((mg.data as any[]) || []).map((x) => x.materials).filter(Boolean) as Material[],
      views: must(views) as MaterialView[],
      attempts: must(attempts) as Attempt[],
      tests: must(tests) as Test[],
    }
  }, [id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const { profile, materials, views, attempts, tests } = data
  const fin = attempts.filter((a) => a.finished_at)
  const avg = fin.length ? Math.round(fin.reduce((s, a) => s + pct(a.score, a.total), 0) / fin.length) : 0
  const vmap = new Map(views.map((v) => [v.material_id, v]))
  const tabs = fin.reduce((s, a) => s + a.tab_switches, 0)

  return (
    <div>
      <Link to="/a/students" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Tələbələr</Link>
      <PageTitle title={profile.full_name} subtitle={`${profile.login} · ${data.group?.name || 'qrupsuz'}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Açılmış materiallar" value={`${views.length}/${materials.length}`} />
        <Stat label="Oxuma vaxtı" value={fmtDuration(views.reduce((s, v) => s + v.seconds, 0))} />
        <Stat label="Orta nəticə" value={<span className={scoreColor(avg)}>{avg}%</span>} sub={`${fin.length} cəhd`} />
        <Stat label="Tab keçidləri" value={tabs} sub="bütün testlərdə" />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">Test nəticələri</h2>
      <div className="mb-8">
        <Table head={['Test', 'Başlanıb', 'Müddət', 'Bal', 'Faiz', 'Tab', '']} empty={attempts.length === 0}>
          {attempts.map((a) => {
            const p = pct(a.score, a.total)
            const dur = a.finished_at ? Math.round((new Date(a.finished_at).getTime() - new Date(a.started_at).getTime()) / 1000) : 0
            return (
              <tr key={a.id}>
                <Td className="font-medium">{tests.find((t) => t.id === a.test_id)?.title}</Td>
                <Td>{fmtDate(a.started_at)}</Td>
                <Td>{a.finished_at ? fmtDuration(dur) : <Badge color="amber">Davam edir</Badge>}</Td>
                <Td>{a.finished_at ? `${a.score}/${a.total}` : '—'}</Td>
                <Td>{a.finished_at && <span className={`font-semibold ${scoreColor(p)}`}>{p}%</span>}</Td>
                <Td>{a.tab_switches > 0 ? <Badge color="amber">{a.tab_switches}</Badge> : 0}</Td>
                <Td>{a.finished_at && <Link to={`/a/attempt/${a.id}`}><Badge color="indigo">Cavablar</Badge></Link>}</Td>
              </tr>
            )
          })}
        </Table>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">Materialların oxunması</h2>
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {materials.length === 0 && <p className="p-5 text-sm text-slate-500">Qrupa material təyin edilməyib</p>}
          {materials.map((m) => {
            const v = vmap.get(m.id)
            const total = m.page_count || v?.page_count || 0
            const p = total && v ? Math.round((v.pages.length / total) * 100) : 0
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="min-w-48 flex-1">
                  <div className="font-medium text-slate-800">{m.title}</div>
                  <div className="text-xs text-slate-500">{v ? `Son dəfə: ${fmtDate(v.last_opened)} · ${fmtDuration(v.seconds)}` : 'Açılmayıb'}</div>
                </div>
                <div className="w-48">
                  <div className="mb-1 text-right text-xs text-slate-500">{v?.pages.length || 0}/{total} səhifə</div>
                  <Progress value={p} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
