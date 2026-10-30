export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDuration(sec: number) {
  if (!sec || sec < 0) return '0 dəq'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h) return `${h} saat ${m} dəq`
  if (sec < 60) return `${sec} san`
  return `${m} dəq`
}

export function pct(score?: number | null, total?: number | null) {
  if (!total) return 0
  return Math.round(((score || 0) / total) * 100)
}

export function scoreColor(p: number) {
  if (p >= 81) return 'text-emerald-600'
  if (p >= 51) return 'text-amber-600'
  return 'text-rose-600'
}

/** Toxum əsasında sabit qarışdırma — səhifə yenilənəndə variantların sırası dəyişmir */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const rand = () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function exportXlsx(rows: Record<string, unknown>[], filename: string, sheet = 'Vərəq1') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheet)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export async function readSheet(file: File | ArrayBuffer): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx')
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, sheetStubs: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // "=SUM(A1:A10)" kimi düstur yazılmış xanaları mətn kimi saxla
  for (const k of Object.keys(ws)) {
    const c = ws[k] as { f?: string; v?: unknown; w?: string; t?: string } | undefined
    if (!k.startsWith('!') && c?.f) {
      c.t = 's'
      c.v = c.w = '=' + c.f
    }
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
}

/** Başlıqları sadələşdirir: "Düzgün cavab" → "duzgun cavab" */
export function normKey(s: string) {
  return s
    .toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

export function pick(row: Record<string, unknown>, ...names: string[]) {
  const wanted = names.map(normKey)
  for (const k of Object.keys(row)) {
    if (wanted.includes(normKey(k))) return String(row[k] ?? '').trim()
  }
  return ''
}

export interface ParsedQuestion {
  text: string
  options: string[]
  correct: number
  explanation: string | null
  topic: string | null
  image: string | null
}

export function parseQuestionRows(rows: Record<string, unknown>[]) {
  const ok: ParsedQuestion[] = []
  const errors: string[] = []
  rows.forEach((row, i) => {
    const line = i + 2
    const text = pick(row, 'Sual', 'Sualın mətni', 'Question')
    if (!text) {
      if (Object.values(row).some((v) => String(v).trim())) errors.push(`Sətir ${line}: sual mətni boşdur`)
      return
    }
    const raw = LETTERS.map((L) => pick(row, L, `Variant ${L}`))
    const keepIdx: number[] = []
    const options: string[] = []
    raw.forEach((o, idx) => {
      if (o) {
        keepIdx.push(idx)
        options.push(o)
      }
    })
    if (options.length < 2) {
      errors.push(`Sətir ${line}: ən azı 2 variant olmalıdır`)
      return
    }
    const ans = pick(row, 'Düzgün', 'Düzgün cavab', 'Cavab', 'Answer').toUpperCase()
    let origIdx = LETTERS.indexOf(ans)
    if (origIdx < 0 && /^\d+$/.test(ans)) origIdx = Number(ans) - 1
    const correct = keepIdx.indexOf(origIdx)
    if (correct < 0) {
      errors.push(`Sətir ${line}: düzgün cavab ("${ans || 'boş'}") mövcud variantlardan biri deyil`)
      return
    }
    ok.push({
      text,
      options,
      correct,
      explanation: pick(row, 'İzah', 'Izah', 'Şərh') || null,
      topic: pick(row, 'Mövzu', 'Movzu', 'Topic') || null,
      image: pick(row, 'Şəkil', 'Sekil', 'Image') || null,
    })
  })
  return { ok, errors }
}

export function downloadQuestionTemplate() {
  exportXlsx(
    [
      { Sual: '1 bayt neçə bitdən ibarətdir?', A: '4', B: '8', C: '16', D: '32', E: '', Düzgün: 'B', İzah: '1 bayt = 8 bit', Mövzu: 'İnformasiyanın ölçülməsi' },
      { Sual: 'Hansı qurğu daxiletmə qurğusudur?', A: 'Monitor', B: 'Printer', C: 'Klaviatura', D: 'Dinamik', E: '', Düzgün: 'C', İzah: '', Mövzu: 'Kompüterin qurğuları' },
    ],
    'sual-nümunəsi.xlsx',
    'Suallar',
  )
}

export function downloadStudentTemplate() {
  exportXlsx(
    [
      { 'Ad Soyad': 'Əli Məmmədov', Login: 'ali.mammadov', Şifrə: '', Qrup: '758 TH' },
      { 'Ad Soyad': 'Aysel Həsənova', Login: 'aysel.hasanova', Şifrə: 'Aysel2026', Qrup: '758 TH' },
    ],
    'tələbə-nümunəsi.xlsx',
    'Tələbələr',
  )
}

/** "Əli Məmmədov" → "ali.mammadov" */
export function suggestLogin(fullName: string) {
  const map: Record<string, string> = { ə: 'a', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g', i̇: 'i' }
  return fullName
    .toLowerCase()
    .replace(/[əıöüşçğ]/g, (c) => map[c] || c)
    .replace(/i̇/g, 'i')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
}
