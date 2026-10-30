import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, Lightbulb, MonitorX, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorBox, Spinner } from '../../components/ui'
import { cn, fmtDate, fmtDuration, LETTERS, pct, scoreColor } from '../../lib/utils'
import { letterOnly, useSignedImages } from '../../lib/images'

interface Review {
  attempt_id: string
  title: string
  student: string
  score: number
  total: number
  started_at: string
  finished_at: string
  tab_switches: number
  show_answers: boolean
  questions: { id: string; text: string; options: string[]; correct: number; chosen: number | null; explanation: string | null; image: string | null }[] | null
}

export default function AttemptReview() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const { data, loading, error } = useAsync(async () => {
    const { data, error } = await supabase.rpc('get_attempt_review', { p_attempt: id })
    if (error) throw new Error(error.message)
    return data as Review
  }, [id])

  const urls = useSignedImages(data?.questions?.map((q) => q.image) ?? [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const p = pct(data.score, data.total)
  const dur = Math.round((new Date(data.finished_at).getTime() - new Date(data.started_at).getTime()) / 1000)
  const wrong = data.questions?.filter((q) => q.chosen !== null && q.chosen !== q.correct).length ?? null
  const empty = data.questions?.filter((q) => q.chosen === null).length ?? null

  return (
    <div className="mx-auto max-w-3xl">
      {isAdmin ? (
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>
      ) : (
        <Link to="/s" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Ana səhifə
        </Link>
      )}

      <Card className="mb-6 text-center">
        <div className="text-sm text-slate-500">{data.title}{isAdmin && ` · ${data.student}`}</div>
        <div className={cn('mt-2 text-5xl font-bold', scoreColor(p))}>{p}%</div>
        <div className="mt-1 text-slate-600">{data.score} / {data.total} düzgün cavab</div>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {fmtDuration(dur)}</span>
          <span>{fmtDate(data.finished_at)}</span>
          {wrong !== null && <span className="text-rose-600">Səhv: {wrong}</span>}
          {empty !== null && <span>Cavabsız: {empty}</span>}
          {isAdmin && data.tab_switches > 0 && (
            <span className="flex items-center gap-1 text-amber-700"><MonitorX className="h-4 w-4" /> Tab keçidi: {data.tab_switches}</span>
          )}
        </div>
      </Card>

      {!data.show_answers || !data.questions ? (
        <p className="text-center text-sm text-slate-500">Müəllim bu test üçün düzgün cavabların göstərilməsini bağlayıb.</p>
      ) : (
        <div className="space-y-4">
          {data.questions.map((q, i) => {
            const ok = q.chosen === q.correct
            return (
              <Card key={q.id} className={cn('border-l-4', ok ? 'border-l-emerald-500' : 'border-l-rose-500')}>
                <div className="flex items-start gap-2">
                  {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
                  <p className="whitespace-pre-wrap font-medium text-slate-900"><span className="text-slate-400">{i + 1}.</span> {q.text}</p>
                </div>
                {q.image && urls[q.image] && (
                  <a href={urls[q.image]} target="_blank" rel="noreferrer" className="mt-3 block pl-7">
                    <img src={urls[q.image]} alt="Sualın şəkli" className="max-h-96 max-w-full rounded-lg border border-slate-200 object-contain" />
                  </a>
                )}
                <div className="mt-3 space-y-1.5 pl-7">
                  {q.options.map((o, j) => (
                    <div
                      key={j}
                      className={cn(
                        'flex gap-2 rounded-lg px-3 py-2 text-sm',
                        j === q.correct ? 'bg-emerald-50 text-emerald-900 font-medium' : j === q.chosen ? 'bg-rose-50 text-rose-900' : 'text-slate-600',
                      )}
                    >
                      <b>{LETTERS[j]})</b> <span className="flex-1 whitespace-pre-wrap">{letterOnly(q.options) ? '' : o}</span>
                      {j === q.correct && <span className="text-xs">✓ düzgün</span>}
                      {j === q.chosen && j !== q.correct && <span className="text-xs">sizin cavab</span>}
                    </div>
                  ))}
                  {q.chosen === null && <div className="px-3 text-xs text-slate-500">Bu suala cavab verilməyib</div>}
                </div>
                {q.explanation && (
                  <div className="ml-7 mt-3 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> <span className="whitespace-pre-wrap">{q.explanation}</span>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
