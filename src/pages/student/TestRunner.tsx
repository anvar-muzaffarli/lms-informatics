import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Card, ErrorBox, Modal, Spinner } from '../../components/ui'
import { cn, LETTERS, seededShuffle } from '../../lib/utils'

interface RunQuestion { id: string; text: string; options: string[] }
interface RunData {
  attempt_id: string
  title: string
  started_at: string
  server_now: string
  time_limit_min: number | null
  shuffle_options: boolean
  answers: Record<string, number>
  tab_switches: number
  questions: RunQuestion[]
}

export default function TestRunner() {
  const { id } = useParams()
  const nav = useNavigate()
  const [run, setRun] = useState<RunData | null>(null)
  const [err, setErr] = useState('')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const [tabs, setTabs] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [warn, setWarn] = useState(false)
  const offset = useRef(0)
  const submitted = useRef(false)
  const answersRef = useRef(answers)
  const tabsRef = useRef(tabs)
  answersRef.current = answers
  tabsRef.current = tabs

  useEffect(() => {
    supabase.rpc('start_attempt', { p_test: id }).then(({ data, error }) => {
      if (error) return setErr(error.message)
      const d = data as RunData
      offset.current = new Date(d.server_now).getTime() - Date.now()
      setRun(d)
      setAnswers(d.answers || {})
      setTabs(d.tab_switches || 0)
    })
  }, [id])

  const submit = useCallback(async () => {
    if (!run || submitted.current) return
    submitted.current = true
    setSubmitting(true)
    const { error } = await supabase.rpc('submit_attempt', {
      p_attempt: run.attempt_id,
      p_answers: answersRef.current,
      p_tab_switches: tabsRef.current,
    })
    if (error) {
      submitted.current = false
      setSubmitting(false)
      setErr(error.message)
      return
    }
    nav(`/s/attempt/${run.attempt_id}`, { replace: true })
  }, [run, nav])

  // Taymer
  useEffect(() => {
    if (!run?.time_limit_min) return
    const end = new Date(run.started_at).getTime() + run.time_limit_min * 60_000
    const tick = () => {
      const s = Math.max(0, Math.round((end - (Date.now() + offset.current)) / 1000))
      setLeft(s)
      if (s <= 0) submit()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [run, submit])

  // Cavabları serverdə avtomatik saxla
  useEffect(() => {
    if (!run || submitted.current) return
    const t = setTimeout(() => {
      supabase.rpc('save_answers', { p_attempt: run.attempt_id, p_answers: answers, p_tab_switches: tabs })
    }, 1200)
    return () => clearTimeout(t)
  }, [answers, tabs, run])

  // Başqa pəncərəyə keçidi say
  useEffect(() => {
    if (!run) return
    const onVis = () => {
      if (document.visibilityState === 'hidden' && !submitted.current) {
        setTabs((n) => n + 1)
        setWarn(true)
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!submitted.current) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [run])

  // Variantların sırası (orijinal indeks saxlanılır)
  const order = useMemo(() => {
    const m: Record<string, number[]> = {}
    run?.questions.forEach((q) => {
      const idxs = q.options.map((_, i) => i)
      m[q.id] = run.shuffle_options ? seededShuffle(idxs, run.attempt_id + q.id) : idxs
    })
    return m
  }, [run])

  if (err)
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorBox>{err}</ErrorBox>
        <Button variant="secondary" onClick={() => nav('/s')}>Ana səhifəyə qayıt</Button>
      </div>
    )
  if (!run) return <Spinner text="Test hazırlanır..." />

  const q = run.questions[idx]
  const answered = run.questions.filter((x) => answers[x.id] !== undefined).length
  const total = run.questions.length
  const mm = left !== null ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : null

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-14 z-30 -mx-4 mb-4 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <h1 className="flex-1 truncate font-semibold text-slate-900">{run.title}</h1>
        <div className="text-sm text-slate-600">Cavablandırılıb: <b>{answered}</b>/{total}</div>
        {mm && (
          <div className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold', left! < 60 ? 'bg-rose-100 text-rose-700 animate-pulse' : left! < 300 ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-700 border border-slate-200')}>
            <Clock className="h-4 w-4" /> {mm}
          </div>
        )}
        <Button onClick={() => setConfirm(true)} loading={submitting}><Send className="h-4 w-4" /> Bitir</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card className="no-select">
          <div className="mb-2 text-sm font-medium text-indigo-600">Sual {idx + 1} / {total}</div>
          <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-slate-900">{q.text}</p>
          <div className="mt-6 space-y-2.5">
            {order[q.id].map((orig, pos) => {
              const selected = answers[q.id] === orig
              return (
                <button
                  key={orig}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: orig }))}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition cursor-pointer',
                    selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold', selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>
                    {LETTERS[pos]}
                  </span>
                  <span className="whitespace-pre-wrap pt-0.5 text-slate-800">{q.options[orig]}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" /> Əvvəlki
            </Button>
            {idx < total - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)}>Növbəti <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => setConfirm(true)}><Send className="h-4 w-4" /> Testi bitir</Button>
            )}
          </div>
        </Card>

        <Card className="h-fit p-4">
          <div className="mb-3 text-sm font-medium text-slate-700">Suallar</div>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {run.questions.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setIdx(i)}
                className={cn(
                  'h-9 rounded-lg text-sm font-medium cursor-pointer',
                  i === idx && 'ring-2 ring-indigo-500 ring-offset-1',
                  answers[x.id] !== undefined ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {tabs > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Başqa pəncərəyə keçid: {tabs} dəfə. Bu, müəllimə göstərilir.
            </div>
          )}
        </Card>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Testi bitirmək istəyirsiniz?">
        <p className="text-sm text-slate-600">
          {total - answered > 0 ? (
            <>Hələ <b className="text-rose-600">{total - answered}</b> sual cavabsız qalıb. </>
          ) : (
            'Bütün suallar cavablandırılıb. '
          )}
          Testi bitirdikdən sonra cavabları dəyişmək mümkün olmayacaq.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Geri qayıt</Button>
          <Button onClick={submit} loading={submitting}>Bəli, bitir</Button>
        </div>
      </Modal>

      <Modal open={warn} onClose={() => setWarn(false)} title="Diqqət!">
        <p className="text-sm text-slate-600">Test zamanı başqa pəncərəyə və ya tab-a keçdiniz. Hər keçid qeydə alınır və müəllimə göstərilir.</p>
        <div className="mt-6 flex justify-end"><Button onClick={() => setWarn(false)}>Anladım</Button></div>
      </Modal>
    </div>
  )
}
