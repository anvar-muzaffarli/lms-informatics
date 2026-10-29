import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, Clock, FileText, PlayCircle, Target } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { must, useAsync } from '../../lib/useAsync'
import type { Attempt, Material, MaterialView, Test } from '../../lib/types'
import { Badge, Card, Empty, ErrorBox, PageTitle, Progress, Spinner, Stat } from '../../components/ui'
import { fmtDate, fmtDuration, pct, scoreColor } from '../../lib/utils'

export function testStatus(t: Test, attempts: Attempt[]) {
  const now = Date.now()
  const unfinished = attempts.find((a) => !a.finished_at)
  const used = attempts.length
  if (unfinished) return { label: 'Davam et', can: true, color: 'amber' as const }
  if (t.opens_at && now < new Date(t.opens_at).getTime()) return { label: `${fmtDate(t.opens_at)} açılır`, can: false, color: 'slate' as const }
  if (t.closes_at && now > new Date(t.closes_at).getTime()) return { label: 'Vaxtı bitib', can: false, color: 'red' as const }
  if (t.max_attempts && used >= t.max_attempts) return { label: 'Cəhdlər bitib', can: false, color: 'slate' as const }
  return { label: used ? 'Yenidən işlə' : 'Başla', can: true, color: 'green' as const }
}

export default function StudentHome() {
  const { profile } = useAuth()
  const { data, loading, error } = useAsync(async () => {
    const [materials, views, tests, attempts] = await Promise.all([
      supabase.from('materials').select('*').order('created_at', { ascending: false }),
      supabase.from('material_views').select('*').eq('user_id', profile!.id),
      supabase.from('tests').select('*').order('created_at', { ascending: false }),
      supabase.from('attempts').select('id,test_id,started_at,finished_at,score,total').eq('user_id', profile!.id),
    ])
    return {
      materials: must(materials) as Material[],
      views: must(views) as MaterialView[],
      tests: must(tests) as Test[],
      attempts: must(attempts) as Attempt[],
    }
  }, [profile?.id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const viewMap = new Map(data.views.map((v) => [v.material_id, v]))
  const finished = data.attempts.filter((a) => a.finished_at)
  const avg = finished.length ? Math.round(finished.reduce((s, a) => s + pct(a.score, a.total), 0) / finished.length) : 0
  const totalRead = data.views.reduce((s, v) => s + v.seconds, 0)
  const testsDone = new Set(finished.map((a) => a.test_id)).size

  return (
    <div>
      <PageTitle title={`Xoş gəlmisiniz, ${profile?.full_name.split(' ')[0]}!`} subtitle="Materialları oxuyun və testləri işləyin" />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Açılmış materiallar" value={`${data.views.length}/${data.materials.length}`} icon={<BookOpen className="h-4 w-4" />} />
        <Stat label="Oxuma vaxtı" value={fmtDuration(totalRead)} icon={<Clock className="h-4 w-4" />} />
        <Stat label="İşlənmiş testlər" value={`${testsDone}/${data.tests.length}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Orta nəticə" value={<span className={scoreColor(avg)}>{avg}%</span>} icon={<Target className="h-4 w-4" />} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-800">Testlər</h2>
      {data.tests.length === 0 ? (
        <Empty>Hələ sizə test təyin edilməyib</Empty>
      ) : (
        <div className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.tests.map((t) => {
            const atts = data.attempts.filter((a) => a.test_id === t.id)
            const best = atts.filter((a) => a.finished_at).reduce((m, a) => Math.max(m, pct(a.score, a.total)), -1)
            const st = testStatus(t, atts)
            const last = atts.filter((a) => a.finished_at).sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
            return (
              <Card key={t.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{t.title}</h3>
                  {best >= 0 && <span className={`text-lg font-bold ${scoreColor(best)}`}>{best}%</span>}
                </div>
                {t.topic && <div className="mt-1 text-xs text-indigo-600">{t.topic}</div>}
                {t.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{t.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {t.time_limit_min && <Badge>{t.time_limit_min} dəq</Badge>}
                  <Badge>Cəhd: {atts.length}/{t.max_attempts ?? '∞'}</Badge>
                  {t.closes_at && <Badge color="amber">Son: {fmtDate(t.closes_at)}</Badge>}
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  {st.can ? (
                    <Link to={`/s/test/${t.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      <PlayCircle className="h-4 w-4" /> {st.label}
                    </Link>
                  ) : (
                    <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">{st.label}</div>
                  )}
                  {last && (
                    <Link to={`/s/attempt/${last.id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Nəticə
                    </Link>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-slate-800">Dərs materialları</h2>
      {data.materials.length === 0 ? (
        <Empty>Hələ material əlavə edilməyib</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.materials.map((m) => {
            const v = viewMap.get(m.id)
            const total = m.page_count || v?.page_count || 0
            const p = total ? Math.round(((v?.pages.length || 0) / total) * 100) : 0
            return (
              <Link key={m.id} to={`/s/material/${m.id}`} className="group">
                <Card className="h-full transition group-hover:border-indigo-300 group-hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-rose-50 p-2 text-rose-600"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{m.title}</h3>
                      {m.topic && <div className="text-xs text-indigo-600">{m.topic}</div>}
                      <div className="mt-1 text-xs text-slate-500">{total ? `${total} səhifə` : ''}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{v ? `${v.pages.length}/${total} səhifə oxunub` : 'Hələ açılmayıb'}</span>
                      <span>{p}%</span>
                    </div>
                    <Progress value={p} />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
