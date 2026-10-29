import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { pdfjsLib } from '../../lib/pdf'
import type { Material } from '../../lib/types'
import { Button, ErrorBox, Spinner } from '../../components/ui'

const HEARTBEAT = 15 // saniyə

export default function MaterialReader() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [material, setMaterial] = useState<Material | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [err, setErr] = useState('')
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastActivity = useRef(Date.now())
  const pageRef = useRef(1)
  const isStudent = profile?.role === 'student'

  // Materialı və PDF-i yüklə
  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    ;(async () => {
      try {
        const { data: m, error } = await supabase.from('materials').select('*').eq('id', id!).single()
        if (error || !m) throw new Error('Material tapılmadı')
        setMaterial(m as Material)
        const { data: signed, error: sErr } = await supabase.storage.from('materials').createSignedUrl(m.file_path, 60 * 60)
        if (sErr || !signed) throw new Error('Fayla giriş icazəsi yoxdur')
        loaded = await pdfjsLib.getDocument({ url: signed.signedUrl }).promise
        if (cancelled) return
        setDoc(loaded)
        // son oxunan səhifədən davam et
        const { data: v } = await supabase.from('material_views').select('last_page').eq('material_id', id!).eq('user_id', profile!.id).maybeSingle()
        const start = v?.last_page && v.last_page <= loaded.numPages ? v.last_page : 1
        setPage(start)
      } catch (e: any) {
        if (!cancelled) setErr(e.message || 'PDF açıla bilmədi')
      }
    })()
    return () => {
      cancelled = true
      loaded?.loadingTask.destroy()
    }
  }, [id, profile])

  // Səhifəni çək
  useEffect(() => {
    if (!doc || !canvasRef.current || !wrapRef.current) return
    let task: RenderTask | null = null
    let cancelled = false
    setRendering(true)
    ;(async () => {
      const p = await doc.getPage(page)
      if (cancelled) return
      const base = p.getViewport({ scale: 1 })
      const width = Math.min(wrapRef.current!.clientWidth, 1000)
      const scale = (width / base.width) * zoom
      const viewport = p.getViewport({ scale })
      const ratio = window.devicePixelRatio || 1
      const canvas = canvasRef.current!
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      task = p.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
      try {
        await task.promise
      } catch {
        /* ləğv edildi */
      }
      if (!cancelled) setRendering(false)
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, zoom])

  // Səhifə dəyişəndə qeyd et
  useEffect(() => {
    pageRef.current = page
    if (doc && isStudent) supabase.rpc('track_reading', { p_material: id, p_page: page, p_seconds: 0, p_page_count: doc.numPages })
  }, [page, doc, id, isStudent])

  // Aktiv oxuma vaxtını say (səhifə görünəndə və istifadəçi son 2 dəqiqədə aktiv olubsa)
  useEffect(() => {
    if (!doc || !isStudent) return
    const mark = () => (lastActivity.current = Date.now())
    const evs = ['mousemove', 'keydown', 'scroll', 'touchstart', 'wheel']
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }))
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity.current < 120_000) {
        supabase.rpc('track_reading', { p_material: id, p_page: pageRef.current, p_seconds: HEARTBEAT, p_page_count: doc.numPages })
      }
    }, HEARTBEAT * 1000)
    return () => {
      clearInterval(t)
      evs.forEach((e) => window.removeEventListener(e, mark))
    }
  }, [doc, id, isStudent])

  // Klaviatura ilə vərəqləmə
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!doc) return
      if (e.key === 'ArrowRight') setPage((p) => Math.min(doc.numPages, p + 1))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc])

  if (err) return <ErrorBox>{err}</ErrorBox>
  if (!doc || !material) return <Spinner text="Material yüklənir..." />

  const n = doc.numPages
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to={profile?.role === 'admin' ? '/a/materials' : '/s'} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-slate-900">{material.title}</h1>
          {material.topic && <div className="text-xs text-indigo-600">{material.topic}</div>}
        </div>
      </div>

      <div className="sticky top-14 z-30 mb-3 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" /> Əvvəlki
        </Button>
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <input
            type="number"
            min={1}
            max={n}
            value={page}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 1 && v <= n) setPage(v)
            }}
            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center"
          />
          / {n}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(n, p + 1))} disabled={page >= n}>
          Növbəti <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-6 w-px bg-slate-200" />
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(1)))} title="Kiçilt"><ZoomOut className="h-4 w-4" /></Button>
        <span className="w-12 text-center text-sm text-slate-600">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))} title="Böyüt"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom(1)} title="Ekrana uyğunlaşdır"><Maximize2 className="h-4 w-4" /></Button>
      </div>

      <div ref={wrapRef} className="no-select relative overflow-auto rounded-xl bg-slate-200 p-2 sm:p-4" onContextMenu={(e) => e.preventDefault()}>
        <div className="relative mx-auto w-fit">
          <canvas ref={canvasRef} className={`block bg-white shadow-lg transition-opacity ${rendering ? 'opacity-60' : ''}`} />
          {/* Su nişanı — icazəsiz paylaşmanın qarşısını almaq üçün */}
          {isStudent && (
            <div className="pointer-events-none absolute inset-0 flex flex-wrap content-around justify-around overflow-hidden opacity-[0.07]">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="-rotate-30 select-none text-2xl font-bold text-slate-900">
                  {profile?.full_name} · {profile?.login}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">← → düymələri ilə səhifələri vərəqləyə bilərsiniz</p>
    </div>
  )
}
