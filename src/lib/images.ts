import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const IMAGE_BUCKET = 'question-images'

/** Sual şəkilləri üçün müvəqqəti (1 saatlıq) keçidlər */
export function useSignedImages(paths: (string | null | undefined)[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = [...new Set(paths.filter(Boolean) as string[])].sort().join('|')
  useEffect(() => {
    const list = key ? key.split('|') : []
    if (!list.length) return
    let cancelled = false
    ;(async () => {
      const out: Record<string, string> = {}
      for (let i = 0; i < list.length; i += 100) {
        const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(list.slice(i, i + 100), 3600)
        data?.forEach((d) => {
          if (d.path && d.signedUrl) out[d.path] = d.signedUrl
        })
      }
      if (!cancelled) setUrls(out)
    })()
    return () => {
      cancelled = true
    }
  }, [key])
  return urls
}

export async function uploadQuestionImage(testId: string, file: Blob, name = 'image.png') {
  const ext = (name.split('.').pop() || 'png').toLowerCase()
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'
  const path = `${testId}/${crypto.randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: type })
  if (error) throw new Error(`Şəkil yüklənmədi: ${error.message}`)
  return path
}

export async function removeQuestionImages(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[]
  if (list.length) await supabase.storage.from(IMAGE_BUCKET).remove(list)
}

/** Variantlar sadəcə "A", "B", ... olarsa (mətn şəkildədir) yalnız hərf göstərilir */
export function letterOnly(options: string[]) {
  return options.every((o, i) => o.trim().toUpperCase() === 'ABCDEF'[i])
}
