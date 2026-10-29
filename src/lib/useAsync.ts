import { useCallback, useEffect, useState } from 'react'

/** Sadə məlumat yükləmə hook-u */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fn())
    } catch (e: any) {
      setError(e?.message || 'Xəta baş verdi')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, error, loading, reload: run, setData }
}

/** Supabase cavabından xətanı atır */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
