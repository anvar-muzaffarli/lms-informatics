import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Download, RotateCcw, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Attempt, Group, Profile, Question, Test } from '../../lib/types'
import { Badge, Button, Card, ErrorBox, PageTitle, Select, Spinner, Stat, Table, Td } from '../../components/ui'
import { cn, exportXlsx, fmtDate, fmtDuration, LETTERS, pct, scoreColor } from '../../lib/utils'
import { letterOnly, useSignedImages } from '../../lib/images'

export default function AdminTestResults() {
  const { id } = useParams()
  const [gf, setGf] = useState('')
  const [tab, setTab] = useState<'students' | 'questions'>('students')
  const { data, loading, error, reload } = useAsync(async () => {
    const [t, q, a, g, tg] = await Promise.all([
      supabase.from('tests').select('*').eq('id', id!).single(),
      supabase.from('questions').select('*').eq('test_id', id!).order('position'),
      supabase.from('attempts').select('*').eq('test_id', id!).order('started_at', { ascending: false }),
      supabase.from('groups').select('*').order('name'),
      supabase.from('test_groups').select('group_id').eq('test_id', id!),
    ])
    const gids = (must(tg) as { group_id: string }[]).map((x) => x.group_id)
    const students = gids.length ? (must(await supabase.from('profiles').select('*').eq('role', 'student').in('group_id', gids).order('full_name')) as Profile[]) : []
    return { test: must(t) as Test, questions: must(q) as Question[], attempts: must(a) as Attempt[], groups: (must(g) as Group[]).filter((x) => gids.includes(x.id)), students }
  }, [id])

  const urls = useSignedImages(tab === 'questions' ? data?.questions.map((q) => q.image_path) ?? [] : [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>
  const { test, questions, groups } = data
  const students = data.students.filter((s) => !gf || s.group_id === gf)
  const sids = new Set(students.map((s) => s.id))
  const attempts = data.attempts.filter((a) => sids.has(a.user_id))
  const fin = attempts.filter((a) => a.finished_at)
  const gName = (gid: string | null) => data.groups.find((g) => g.id === gid)?.name || '—'
  const sName = (uid: string) => data.students.find((s) => s.id === uid)

  // Hər tələbənin ən yaxşı nəticəsi
  const best = new Map<string, Attempt>()
  fin.forEach((a) => {
    const b = best.get(a.user_id)
    if (!b || pct(a.score, a.total) > pct(b.score, b.total)) best.set(a.user_id, a)
  })
  const bestP = [...best.values()].map((a) => pct(a.score, a.total))
  const avg = bestP.length ? Math.round(bestP.reduce((s, x) => s + x, 0) / bestP.length) : 0
  const sorted = [...bestP].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const notTaken = students.filter((s) => !attempts.some((a) => a.user_id === s.id))

  const dist = ['0-20', '21-40', '41-60', '61-80', '81-100'].map((label, i) => ({
    label,
    say: bestP.filter((p) => (i === 0 ? p <= 20 : p > i * 20 && p <= (i + 1) * 20)).length,
  }))

  // Sual üzrə təhlil
  const qStats = questions
    .map((q) => {
      const shown = fin.filter((a) => a.question_ids.includes(q.id))
      const picks = q.options.map(() => 0)
      let blank = 0
      shown.forEach((a) => {
        const c = a.answers[q.id]
        if (c === undefined || c === null) blank++
        else if (picks[c] !== undefined) picks[c]++
      })
      const correct = picks[q.correct] || 0
      return { q, shown: shown.length, correct, picks, blank, rate: shown.length ? Math.round((correct / shown.length) * 100) : null }
    })
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))

  const resetAttempt = async (a: Attempt) => {
    if (!confirm('Bu cəhd silinsin? Tələbə testi yenidən işləyə biləcək.')) return
    await supabase.from('attempts').delete().eq('id', a.id)
    reload()
  }

  const exportAll = () => {
    const rows = students.map((s) => {
      const atts = fin.filter((a) => a.user_id === s.id)
      const b = best.get(s.id)
      return {
        'Ad Soyad': s.full_name,
        Qrup: gName(s.group_id),
        'Cəhd sayı': atts.length,
        'Ən yaxşı bal': b ? `${b.score}/${b.total}` : '',
        'Faiz': b ? pct(b.score, b.total) : '',
        'Tab keçidi': b?.tab_switches ?? '',
        Tarix: b ? fmtDate(b.finished_at) : 'İşləməyib',
      }
    })
    exportXlsx(rows, `${test.title}-nəticələr.xlsx`, 'Nəticələr')
  }

  return (
    <div>
      <Link to={`/a/tests/${test.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Testə qayıt</Link>
      <PageTitle title={test.title} subtitle="Nəticələr və təhlil" actions={
        <>
          <Select className="w-44" value={gf} onChange={(e) => setGf(e.target.value)}>
            <option value="">Bütün qruplar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={exportAll}><Download className="h-4 w-4" /> Excel</Button>
        </>
      } />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="İşləyənlər" value={`${best.size}/${students.length}`} />
        <Stat label="Orta nəticə" value={<span className={scoreColor(avg)}>{avg}%</span>} sub="ən yaxşı cəhdlər üzrə" />
        <Stat label="Median" value={`${median}%`} />
        <Stat label="Ən yüksək" value={`${sorted.length ? sorted[sorted.length - 1] : 0}%`} />
        <Stat label="Ən aşağı" value={`${sorted.length ? sorted[0] : 0}%`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Balların paylanması</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="say" name="Tələbə sayı" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><UserX className="h-4 w-4 text-rose-500" /> İşləməyənlər ({notTaken.length})</h3>
          <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {notTaken.map((s) => <div key={s.id} className="flex justify-between"><span>{s.full_name}</span><span className="text-xs text-slate-500">{gName(s.group_id)}</span></div>)}
            {notTaken.length === 0 && <p className="text-slate-500">Hamı işləyib 👍</p>}
          </div>
        </Card>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm w-fit">
        {(['students', 'questions'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={cn('rounded-md px-4 py-1.5 font-medium cursor-pointer', tab === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600')}>
            {k === 'students' ? `Cəhdlər (${attempts.length})` : 'Sual üzrə təhlil'}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <Table head={['Tələbə', 'Qrup', 'Başlanıb', 'Müddət', 'Bal', 'Faiz', 'Tab', '']} empty={attempts.length === 0}>
          {attempts.map((a) => {
            const s = sName(a.user_id)
            const p = pct(a.score, a.total)
            const dur = a.finished_at ? Math.round((new Date(a.finished_at).getTime() - new Date(a.started_at).getTime()) / 1000) : 0
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <Td><Link to={`/a/students/${a.user_id}`} className="font-medium text-indigo-700 hover:underline">{s?.full_name}</Link></Td>
                <Td>{gName(s?.group_id ?? null)}</Td>
                <Td className="text-xs">{fmtDate(a.started_at)}</Td>
                <Td>{a.finished_at ? fmtDuration(dur) : <Badge color="amber">Davam edir</Badge>}</Td>
                <Td>{a.finished_at ? `${a.score}/${a.total}` : '—'}</Td>
                <Td>{a.finished_at && <span className={`font-semibold ${scoreColor(p)}`}>{p}%</span>}</Td>
                <Td>{a.tab_switches > 0 ? <Badge color={a.tab_switches > 3 ? 'red' : 'amber'}>{a.tab_switches}</Badge> : <span className="text-slate-400">0</span>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {a.finished_at && <Link to={`/a/attempt/${a.id}`}><Badge color="indigo">Cavablar</Badge></Link>}
                  <Button variant="ghost" size="sm" onClick={() => resetAttempt(a)} title="Cəhdi sil (yenidən işləsin)"><RotateCcw className="h-4 w-4" /></Button>
                </Td>
              </tr>
            )
          })}
        </Table>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Ən çətin suallar yuxarıdadır. Yaşıl — düzgün variant, qırmızı — ən çox seçilən səhv variant.</p>
          {qStats.map(({ q, shown, picks, blank, rate }) => {
            const wrongMax = Math.max(0, ...picks.filter((_, i) => i !== q.correct))
            return (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap font-medium text-slate-900">{q.text}</p>
                  <div className="shrink-0 text-right">
                    <div className={`text-xl font-bold ${rate === null ? 'text-slate-400' : scoreColor(rate)}`}>{rate === null ? '—' : `${rate}%`}</div>
                    <div className="text-xs text-slate-500">{shown} dəfə verilib</div>
                  </div>
                </div>
                {q.image_path && urls[q.image_path] && (
                  <a href={urls[q.image_path]} target="_blank" rel="noreferrer"><img src={urls[q.image_path]} alt="" loading="lazy" className="mt-2 max-h-48 max-w-full rounded border border-slate-200 object-contain" /></a>
                )}
                <div className="mt-3 space-y-1.5">
                  {q.options.map((o, i) => {
                    const w = shown ? Math.round((picks[i] / shown) * 100) : 0
                    const isWrongTop = i !== q.correct && picks[i] > 0 && picks[i] === wrongMax
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 font-bold text-slate-500">{LETTERS[i]}</span>
                        <div className="relative h-7 flex-1 overflow-hidden rounded bg-slate-100">
                          <div className={cn('absolute inset-y-0 left-0', i === q.correct ? 'bg-emerald-200' : isWrongTop ? 'bg-rose-200' : 'bg-slate-200')} style={{ width: `${w}%` }} />
                          <span className="relative z-10 flex h-full items-center px-2 text-slate-800">{letterOnly(q.options) ? '' : o}</span>
                        </div>
                        <span className="w-16 text-right text-xs text-slate-600">{picks[i]} ({w}%)</span>
                      </div>
                    )
                  })}
                  {blank > 0 && <div className="pl-7 text-xs text-slate-500">Cavabsız: {blank}</div>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
