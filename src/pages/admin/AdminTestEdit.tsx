import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download, FileSpreadsheet, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Group, Question, Test } from '../../lib/types'
import { Badge, Button, Card, Checkbox, ErrorBox, Field, Input, Modal, PageTitle, Select, Spinner, Textarea } from '../../components/ui'
import GroupPicker from '../../components/GroupPicker'
import { downloadQuestionTemplate, exportXlsx, LETTERS, parseQuestionRows, readSheet, type ParsedQuestion } from '../../lib/utils'
import { letterOnly, removeQuestionImages, uploadQuestionImage, useSignedImages } from '../../lib/images'

const toLocal = (s: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const fromLocal = (s: string) => (s ? new Date(s).toISOString() : null)

export default function AdminTestEdit() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    const [t, g, tg, q] = await Promise.all([
      supabase.from('tests').select('*').eq('id', id!).single(),
      supabase.from('groups').select('*').order('name'),
      supabase.from('test_groups').select('group_id').eq('test_id', id!),
      supabase.from('questions').select('*').eq('test_id', id!).order('position'),
    ])
    return {
      test: must(t) as Test,
      groups: must(g) as Group[],
      gids: (must(tg) as { group_id: string }[]).map((x) => x.group_id),
      questions: must(q) as Question[],
    }
  }, [id])

  const [t, setT] = useState<Test | null>(null)
  const [gids, setGids] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [err, setErr] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [editQ, setEditQ] = useState<Question | 'new' | null>(null)

  useEffect(() => {
    if (data) {
      setT(data.test)
      setGids(data.gids)
    }
  }, [data])

  const urls = useSignedImages(data?.questions.map((q) => q.image_path) ?? [])

  if (loading || !t) return error ? <ErrorBox>{error}</ErrorBox> : <Spinner />
  if (!data) return null
  const qs = data.questions
  const set = <K extends keyof Test>(k: K, v: Test[K]) => setT({ ...t, [k]: v })

  const save = async () => {
    setSaving(true)
    setErr('')
    setSaved('')
    try {
      if (t.published && qs.length === 0) throw new Error('Sualı olmayan testi dərc etmək olmaz')
      if (t.published && gids.length === 0) throw new Error('Dərc etmək üçün ən azı bir qrup seçin')
      const { id: _i, created_at: _c, ...rest } = t
      must(await supabase.from('tests').update(rest).eq('id', t.id).select())
      await supabase.from('test_groups').delete().eq('test_id', t.id)
      if (gids.length) must(await supabase.from('test_groups').insert(gids.map((g) => ({ test_id: t.id, group_id: g }))).select())
      setSaved('Yadda saxlanıldı')
      setTimeout(() => setSaved(''), 2500)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const delQ = async (q: Question) => {
    if (!confirm('Bu sual silinsin?')) return
    await supabase.from('questions').delete().eq('id', q.id)
    await removeQuestionImages([q.image_path])
    reload()
  }

  const clearAll = async () => {
    if (!confirm(`Bütün ${qs.length} sual silinsin?`)) return
    await supabase.from('questions').delete().eq('test_id', t.id)
    await removeQuestionImages(qs.map((q) => q.image_path))
    reload()
  }

  const exportQs = () =>
    exportXlsx(
      qs.map((q) => {
        const row: Record<string, string> = { Sual: q.text }
        LETTERS.forEach((L, i) => (row[L] = q.options[i] || ''))
        row['Düzgün'] = LETTERS[q.correct]
        row['İzah'] = q.explanation || ''
        row['Mövzu'] = q.topic || ''
        return row
      }),
      `${t.title}-suallar.xlsx`,
      'Suallar',
    )

  return (
    <div>
      <Link to="/a/tests" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Testlər</Link>
      <PageTitle
        title={t.title || 'Test'}
        subtitle={`${qs.length} sual`}
        actions={
          <>
            <Link to={`/a/tests/${t.id}/results`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <BarChart3 className="h-4 w-4" /> Nəticələr
            </Link>
            <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Yadda saxla</Button>
          </>
        }
      />
      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}
      {saved && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saved}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Suallar</h2>
            <div className="flex flex-wrap gap-2">
              {qs.length > 0 && <Button variant="ghost" size="sm" onClick={clearAll}><Trash2 className="h-4 w-4" /> Hamısını sil</Button>}
              {qs.length > 0 && <Button variant="secondary" size="sm" onClick={exportQs}><Download className="h-4 w-4" /> Excel</Button>}
              <Button variant="secondary" size="sm" onClick={() => setEditQ('new')}><Plus className="h-4 w-4" /> Sual əlavə et</Button>
              <Button size="sm" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" /> Excel-dən yüklə</Button>
            </div>
          </div>
          {qs.length === 0 && (
            <Card className="text-center text-sm text-slate-500">
              Hələ sual yoxdur. Sualları Excel faylından yükləyin və ya bir-bir əlavə edin.
              <div className="mt-3"><button onClick={downloadQuestionTemplate} className="font-medium text-indigo-600 underline cursor-pointer">Excel nümunəsini yüklə</button></div>
            </Card>
          )}
          {qs.map((q, i) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-sm font-bold text-slate-400">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap font-medium text-slate-900">{q.text}</p>
                  {q.image_path && urls[q.image_path] && (
                    <a href={urls[q.image_path]} target="_blank" rel="noreferrer">
                      <img src={urls[q.image_path]} alt="" className="mt-2 max-h-56 max-w-full rounded border border-slate-200 object-contain" loading="lazy" />
                    </a>
                  )}
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {q.options.map((o, j) => (
                      <div key={j} className={`rounded px-2 py-1 text-sm ${j === q.correct ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600'}`}>
                        <b>{LETTERS[j]})</b> {letterOnly(q.options) ? (j === q.correct ? '✓' : '') : o}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {q.topic && <Badge color="indigo">{q.topic}</Badge>}
                    {q.explanation && <Badge>İzah var</Badge>}
                    {q.image_path && <Badge color="amber">Şəkilli</Badge>}
                  </div>
                </div>
                <div className="flex flex-col">
                  <Button variant="ghost" size="sm" onClick={() => setEditQ(q)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => delQ(q)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h3 className="font-semibold text-slate-800">Əsas məlumat</h3>
            <Field label="Testin adı"><Input value={t.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Mövzu"><Input value={t.topic || ''} onChange={(e) => set('topic', e.target.value || null)} /></Field>
            <Field label="Təsvir / təlimat"><Textarea rows={3} value={t.description || ''} onChange={(e) => set('description', e.target.value || null)} /></Field>
          </Card>
          <Card className="space-y-3">
            <h3 className="font-semibold text-slate-800">Ayarlar</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vaxt (dəqiqə)" hint="Boş = limitsiz">
                <Input type="number" min={1} value={t.time_limit_min ?? ''} onChange={(e) => set('time_limit_min', e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Cəhd sayı" hint="Boş = limitsiz">
                <Input type="number" min={1} value={t.max_attempts ?? ''} onChange={(e) => set('max_attempts', e.target.value ? Number(e.target.value) : null)} />
              </Field>
            </div>
            <Field label="Hər cəhddə sual sayı" hint={`Sual bankından təsadüfi seçilir. Boş = hamısı (${qs.length})`}>
              <Input type="number" min={1} max={qs.length || undefined} value={t.questions_per_attempt ?? ''} onChange={(e) => set('questions_per_attempt', e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Açılma vaxtı"><Input type="datetime-local" value={toLocal(t.opens_at)} onChange={(e) => set('opens_at', fromLocal(e.target.value))} /></Field>
              <Field label="Bağlanma vaxtı"><Input type="datetime-local" value={toLocal(t.closes_at)} onChange={(e) => set('closes_at', fromLocal(e.target.value))} /></Field>
            </div>
            <div className="space-y-2 pt-1">
              <Checkbox label="Sualların sırasını qarışdır" checked={t.shuffle_questions} onChange={(v) => set('shuffle_questions', v)} />
              <Checkbox label="Variantların sırasını qarışdır" checked={t.shuffle_options} onChange={(v) => set('shuffle_options', v)} />
              <Checkbox label="Bitirdikdən sonra düzgün cavabları göstər" checked={t.show_answers} onChange={(v) => set('show_answers', v)} />
            </div>
          </Card>
          <Card className="space-y-3">
            <h3 className="font-semibold text-slate-800">Qruplar</h3>
            <GroupPicker groups={data.groups} value={gids} onChange={setGids} />
          </Card>
          <Card className={t.published ? 'border-emerald-300 bg-emerald-50' : ''}>
            <Checkbox label="Dərc et (tələbələr görə bilsin)" checked={t.published} onChange={(v) => set('published', v)} />
            <p className="mt-2 text-xs text-slate-500">Dəyişikliklərdən sonra "Yadda saxla" düyməsini basmağı unutmayın.</p>
          </Card>
        </div>
      </div>

      <ImportModal open={importOpen} testId={t.id} startPos={qs.length} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); reload() }} />
      {editQ && <QuestionModal q={editQ === 'new' ? null : editQ} testId={t.id} pos={qs.length} onClose={() => setEditQ(null)} onSaved={() => { setEditQ(null); reload() }} />}
    </div>
  )
}

type ZipImages = Map<string, () => Promise<Blob>>

function ImportModal({ open, testId, startPos, onClose, onDone }: { open: boolean; testId: string; startPos: number; onClose: () => void; onDone: () => void }) {
  const [parsed, setParsed] = useState<{ ok: ParsedQuestion[]; errors: string[] } | null>(null)
  const [images, setImages] = useState<ZipImages | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')

  const onFile = async (f?: File) => {
    if (!f) return
    setErr('')
    setImages(null)
    try {
      if (/\.zip$/i.test(f.name)) {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(f)
        const files = Object.values(zip.files).filter((z) => !z.dir && !z.name.startsWith('__MACOSX'))
        const sheet = files.find((z) => /\.(xlsx|xls|csv)$/i.test(z.name))
        if (!sheet) throw new Error('ZIP faylında Excel faylı tapılmadı')
        const map: ZipImages = new Map()
        files.filter((z) => /\.(png|jpe?g|webp|gif)$/i.test(z.name)).forEach((z) => {
          const base = z.name.split('/').pop()!.toLowerCase()
          map.set(base, () => z.async('blob'))
        })
        const result = parseQuestionRows(await readSheet(await sheet.async('arraybuffer')))
        const missing = result.ok.filter((q) => q.image && !map.has(q.image.split('/').pop()!.toLowerCase()))
        missing.forEach((q) => result.errors.push(`"${q.image}" şəkli ZIP-də tapılmadı (sual: ${q.text.slice(0, 40)}…)`))
        result.ok = result.ok.filter((q) => !missing.includes(q))
        setImages(map)
        setParsed(result)
      } else {
        const result = parseQuestionRows(await readSheet(f))
        const withImg = result.ok.filter((q) => q.image)
        if (withImg.length) {
          result.errors.push(`${withImg.length} sualda şəkil göstərilib. Şəkilləri də yükləmək üçün Excel faylını şəkillərlə birlikdə ZIP kimi seçin.`)
          result.ok = result.ok.filter((q) => !q.image)
        }
        setParsed(result)
      }
    } catch (e: any) {
      setErr('Fayl oxuna bilmədi: ' + e.message)
    }
  }

  const go = async () => {
    if (!parsed) return
    setBusy(true)
    setErr('')
    try {
      const rows: Record<string, unknown>[] = []
      let done = 0
      const total = parsed.ok.filter((q) => q.image).length
      for (const [i, q] of parsed.ok.entries()) {
        let image_path: string | null = null
        if (q.image && images) {
          const name = q.image.split('/').pop()!
          const blob = await images.get(name.toLowerCase())!()
          image_path = await uploadQuestionImage(testId, blob, name)
          setProgress(`Şəkillər yüklənir: ${++done}/${total}`)
        }
        const { image: _img, ...rest } = q
        rows.push({ ...rest, image_path, test_id: testId, position: startPos + i + 1 })
      }
      setProgress('Suallar yazılır...')
      for (let i = 0; i < rows.length; i += 200) must(await supabase.from('questions').insert(rows.slice(i, i + 200)).select('id'))
      setParsed(null)
      setProgress('')
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sualları fayldan yüklə" wide>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Sütunlar: <b>Sual</b>, <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b>, <b>E</b> (lazım olduğu qədər), <b>Düzgün</b> (A–F hərfi), <b>İzah</b>, <b>Mövzu</b> və <b>Şəkil</b> (könüllü).
          Excel (.xlsx) və CSV qəbul olunur. <b>Şəkilli suallar</b> üçün Excel faylını və şəkilləri bir <b>ZIP</b> faylına yığın: "Şəkil" sütununda şəklin fayl adı yazılır (məs. 012.png).
          <button onClick={downloadQuestionTemplate} className="ml-1 font-medium text-indigo-600 underline cursor-pointer">Nümunə faylı yüklə</button>
        </div>
        <input type="file" accept=".xlsx,.xls,.csv,.zip" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700" />
        {err && <ErrorBox>{err}</ErrorBox>}
        {parsed && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge color="green">{parsed.ok.length} sual hazırdır</Badge>
              {parsed.ok.some((q) => q.image) && <Badge color="amber">{parsed.ok.filter((q) => q.image).length} şəkilli</Badge>}
              {parsed.errors.length > 0 && <Badge color="red">{parsed.errors.length} xəbərdarlıq</Badge>}
            </div>
            {parsed.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {parsed.ok.slice(0, 50).map((q, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="font-medium">{i + 1}. {q.text} {q.image && <span className="text-xs text-amber-700">[şəkil: {q.image}]</span>}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {q.options.map((o, j) => <span key={j} className={j === q.correct ? 'mr-3 font-bold text-emerald-700' : 'mr-3'}>{LETTERS[j]}) {letterOnly(q.options) ? '' : o}</span>)}
                  </div>
                </div>
              ))}
              {parsed.ok.length > 50 && <p className="text-center text-xs text-slate-500">...və daha {parsed.ok.length - 50} sual</p>}
            </div>
            {progress && <p className="text-sm text-indigo-700">{progress}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setParsed(null)} disabled={busy}>Ləğv et</Button>
              <Button onClick={go} loading={busy} disabled={!parsed.ok.length}>{parsed.ok.length} sualı əlavə et</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function QuestionModal({ q, testId, pos, onClose, onSaved }: { q: Question | null; testId: string; pos: number; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(q?.text || '')
  const [options, setOptions] = useState<string[]>(q?.options || ['', '', '', ''])
  const [correct, setCorrect] = useState(q?.correct ?? 0)
  const [explanation, setExplanation] = useState(q?.explanation || '')
  const [topic, setTopic] = useState(q?.topic || '')
  const [imagePath, setImagePath] = useState<string | null>(q?.image_path || null)
  const [newImage, setNewImage] = useState<File | null>(null)
  const preview = useSignedImages([imagePath])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    const opts = options.map((o) => o.trim())
    const kept = opts.map((o, i) => ({ o, i })).filter((x) => x.o)
    if (!text.trim()) return setErr('Sual mətni boşdur')
    if (kept.length < 2) return setErr('Ən azı 2 variant yazın')
    const c = kept.findIndex((x) => x.i === correct)
    if (c < 0) return setErr('Düzgün cavab boş variant ola bilməz')
    setBusy(true)
    let image_path = imagePath
    try {
      if (newImage) image_path = await uploadQuestionImage(testId, newImage, newImage.name)
    } catch (e: any) {
      setBusy(false)
      return setErr(e.message)
    }
    if (q?.image_path && q.image_path !== image_path) await removeQuestionImages([q.image_path])
    const row = { text: text.trim(), options: kept.map((x) => x.o), correct: c, explanation: explanation.trim() || null, topic: topic.trim() || null, image_path }
    const res = q
      ? await supabase.from('questions').update(row).eq('id', q.id)
      : await supabase.from('questions').insert({ ...row, test_id: testId, position: pos + 1 })
    setBusy(false)
    if (res.error) return setErr(res.error.message)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={q ? 'Sualı redaktə et' : 'Yeni sual'} wide>
      <div className="space-y-3">
        <Field label="Sual"><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Field label="Şəkil (könüllü)" hint="PNG, JPG və ya WEBP, ən çox 5 MB">
          <div className="space-y-2">
            {newImage ? (
              <img src={URL.createObjectURL(newImage)} alt="" className="max-h-48 rounded border border-slate-200" />
            ) : imagePath && preview[imagePath] ? (
              <img src={preview[imagePath]} alt="" className="max-h-48 rounded border border-slate-200" />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setNewImage(e.target.files?.[0] || null)} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700" />
              {(imagePath || newImage) && (
                <Button variant="ghost" size="sm" onClick={() => { setImagePath(null); setNewImage(null) }}>Şəkli sil</Button>
              )}
            </div>
          </div>
        </Field>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Variantlar (düzgün olanı seçin)</span>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" className="h-4 w-4 accent-emerald-600" checked={correct === i} onChange={() => setCorrect(i)} />
              <span className="w-5 font-bold text-slate-500">{LETTERS[i]}</span>
              <Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 && (
                <Button variant="ghost" size="sm" onClick={() => { setOptions(options.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(correct - 1) }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 6 && <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ''])}><Plus className="h-4 w-4" /> Variant əlavə et</Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mövzu"><Input value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
          <Field label="Düzgün cavab">
            <Select value={correct} onChange={(e) => setCorrect(Number(e.target.value))}>
              {options.map((_, i) => <option key={i} value={i}>{LETTERS[i]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="İzah" hint="Tələbə testi bitirəndən sonra görür"><Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} loading={busy}>Saxla</Button>
        </div>
      </div>
    </Modal>
  )
}
