import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Group, Test } from '../../lib/types'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageTitle, Spinner, Table, Td } from '../../components/ui'
import { fmtDate, pct, scoreColor } from '../../lib/utils'

export default function AdminTests() {
  const nav = useNavigate()
  const { data, loading, error, reload } = useAsync(async () => {
    const [t, g, tg, q, a] = await Promise.all([
      supabase.from('tests').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('*'),
      supabase.from('test_groups').select('*'),
      supabase.from('questions').select('test_id'),
      supabase.from('attempts').select('test_id,score,total').not('finished_at', 'is', null),
    ])
    return {
      tests: must(t) as Test[],
      groups: must(g) as Group[],
      links: must(tg) as { test_id: string; group_id: string }[],
      qs: must(q) as { test_id: string }[],
      atts: must(a) as { test_id: string; score: number; total: number }[],
    }
  })
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const create = async () => {
    setBusy(true)
    const { data: t, error } = await supabase.from('tests').insert({ title: title.trim() }).select('id').single()
    setBusy(false)
    if (!error && t) nav(`/a/tests/${t.id}`)
  }

  const duplicate = async (t: Test) => {
    const { id: _id, created_at: _c, ...rest } = t
    const copy = must(await supabase.from('tests').insert({ ...rest, title: `${t.title} (surət)`, published: false }).select('id').single()) as { id: string }
    const qs = must(await supabase.from('questions').select('position,text,options,correct,explanation,topic').eq('test_id', t.id)) as any[]
    if (qs.length) await supabase.from('questions').insert(qs.map((q) => ({ ...q, test_id: copy.id })))
    reload()
  }

  const remove = async (t: Test) => {
    if (!confirm(`"${t.title}" testi silinsin? Bütün suallar və nəticələr silinəcək.`)) return
    await supabase.from('tests').delete().eq('id', t.id)
    reload()
  }

  return (
    <div>
      <PageTitle title="Testlər" subtitle="Test yaradın, sualları Excel-dən yükləyin" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni test</Button>} />
      {data.tests.length === 0 ? (
        <Empty>Hələ test yoxdur</Empty>
      ) : (
        <Table head={['Test', 'Status', 'Suallar', 'Qruplar', 'Cəhdlər', 'Orta', '']}>
          {data.tests.map((t) => {
            const gids = data.links.filter((l) => l.test_id === t.id).map((l) => l.group_id)
            const n = data.qs.filter((q) => q.test_id === t.id).length
            const at = data.atts.filter((a) => a.test_id === t.id)
            const avg = at.length ? Math.round(at.reduce((s, a) => s + pct(a.score, a.total), 0) / at.length) : null
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <Td>
                  <Link to={`/a/tests/${t.id}`} className="font-medium text-indigo-700 hover:underline">{t.title}</Link>
                  <div className="text-xs text-slate-500">{t.topic || ''} {fmtDate(t.created_at)}</div>
                </Td>
                <Td>{t.published ? <Badge color="green">Dərc edilib</Badge> : <Badge>Qaralama</Badge>}</Td>
                <Td>{n}{t.questions_per_attempt ? <span className="text-xs text-slate-500"> (hər cəhddə {t.questions_per_attempt})</span> : ''}</Td>
                <Td><div className="flex flex-wrap gap-1">{gids.map((g) => <Badge key={g} color="indigo">{data.groups.find((x) => x.id === g)?.name}</Badge>)}</div></Td>
                <Td>{at.length}</Td>
                <Td>{avg !== null ? <span className={`font-semibold ${scoreColor(avg)}`}>{avg}%</span> : '—'}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Link to={`/a/tests/${t.id}/results`} className="inline-flex rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Nəticələr"><BarChart3 className="h-4 w-4" /></Link>
                  <Link to={`/a/tests/${t.id}`} className="inline-flex rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Redaktə et"><Pencil className="h-4 w-4" /></Link>
                  <Button variant="ghost" size="sm" onClick={() => duplicate(t)} title="Surətini çıxar"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t)} title="Sil"><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </Td>
              </tr>
            )
          })}
        </Table>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Yeni test">
        <Field label="Testin adı"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Məs: Say sistemləri — 1-ci test" onKeyDown={(e) => e.key === 'Enter' && title.trim() && create()} /></Field>
        <div className="mt-4 flex justify-end"><Button onClick={create} loading={busy} disabled={!title.trim()}>Yarat və davam et</Button></div>
      </Modal>
    </div>
  )
}
