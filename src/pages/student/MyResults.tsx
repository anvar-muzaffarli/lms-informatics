import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { must, useAsync } from '../../lib/useAsync'
import { ErrorBox, PageTitle, Spinner, Table, Td, Badge } from '../../components/ui'
import { fmtDate, fmtDuration, pct, scoreColor } from '../../lib/utils'

export default function MyResults() {
  const { profile } = useAuth()
  const { data, loading, error } = useAsync(async () => {
    const rows = must(
      await supabase
        .from('attempts')
        .select('id,started_at,finished_at,score,total,tests(title)')
        .eq('user_id', profile!.id)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false }),
    ) as any[]
    return rows
  }, [profile?.id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  return (
    <div>
      <PageTitle title="Nəticələrim" subtitle={`Cəmi ${data.length} bitirilmiş cəhd`} />
      <Table head={['Test', 'Tarix', 'Müddət', 'Bal', 'Faiz', '']} empty={data.length === 0}>
        {data.map((a) => {
          const p = pct(a.score, a.total)
          const dur = a.finished_at ? Math.round((new Date(a.finished_at).getTime() - new Date(a.started_at).getTime()) / 1000) : 0
          return (
            <tr key={a.id}>
              <Td className="font-medium text-slate-800">{a.tests?.title}</Td>
              <Td>{fmtDate(a.started_at)}</Td>
              <Td>{fmtDuration(dur)}</Td>
              <Td>{a.score}/{a.total}</Td>
              <Td><span className={`font-semibold ${scoreColor(p)}`}>{p}%</span></Td>
              <Td><Link to={`/s/attempt/${a.id}`}><Badge color="indigo">Bax</Badge></Link></Td>
            </tr>
          )
        })}
      </Table>
    </div>
  )
}
