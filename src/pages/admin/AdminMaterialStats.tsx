import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Group, Material, MaterialView, Profile } from '../../lib/types'
import { Badge, Button, ErrorBox, PageTitle, Progress, Select, Spinner, Stat, Table, Td } from '../../components/ui'
import { exportXlsx, fmtDate, fmtDuration } from '../../lib/utils'

export default function AdminMaterialStats() {
  const { id } = useParams()
  const [gf, setGf] = useState('')
  const { data, loading, error } = useAsync(async () => {
    const material = must(await supabase.from('materials').select('*').eq('id', id!).single()) as Material
    const [mg, groups, views] = await Promise.all([
      supabase.from('material_groups').select('group_id').eq('material_id', id!),
      supabase.from('groups').select('*').order('name'),
      supabase.from('material_views').select('*').eq('material_id', id!),
    ])
    const gids = (must(mg) as { group_id: string }[]).map((x) => x.group_id)
    const students = gids.length
      ? (must(await supabase.from('profiles').select('*').eq('role', 'student').in('group_id', gids).order('full_name')) as Profile[])
      : []
    return { material, groups: (must(groups) as Group[]).filter((g) => gids.includes(g.id)), views: must(views) as MaterialView[], students }
  }, [id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>
  const { material, views, students, groups } = data
  const total = material.page_count || 1
  const vmap = new Map(views.map((v) => [v.user_id, v]))
  const list = students.filter((s) => !gf || s.group_id === gf)
  const opened = list.filter((s) => vmap.has(s.id)).length
  const full = list.filter((s) => (vmap.get(s.id)?.pages.length || 0) >= total).length
  const avgSec = opened ? Math.round(list.reduce((s, x) => s + (vmap.get(x.id)?.seconds || 0), 0) / opened) : 0
  const gName = (gid: string | null) => groups.find((g) => g.id === gid)?.name || '—'

  const rows = list.map((s) => {
    const v = vmap.get(s.id)
    return { s, v, p: v ? Math.round((v.pages.length / total) * 100) : 0 }
  }).sort((a, b) => b.p - a.p)

  const exp = () => exportXlsx(rows.map(({ s, v, p }) => ({
    'Ad Soyad': s.full_name, Qrup: gName(s.group_id), 'Oxunan səhifə': v?.pages.length || 0, 'Ümumi səhifə': total, 'Faiz': p,
    'Vaxt (dəq)': Math.round((v?.seconds || 0) / 60), 'İlk açılış': v ? fmtDate(v.first_opened) : '', 'Son açılış': v ? fmtDate(v.last_opened) : '',
  })), `${material.title}-oxuma.xlsx`)

  return (
    <div>
      <Link to="/a/materials" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Materiallar</Link>
      <PageTitle title={material.title} subtitle={`${total} səhifə · oxuma statistikası`} actions={
        <>
          <Select className="w-44" value={gf} onChange={(e) => setGf(e.target.value)}>
            <option value="">Bütün qruplar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={exp}><Download className="h-4 w-4" /> Excel</Button>
        </>
      } />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Açanlar" value={`${opened}/${list.length}`} />
        <Stat label="Tam oxuyanlar" value={full} />
        <Stat label="Heç açmayanlar" value={list.length - opened} />
        <Stat label="Orta oxuma vaxtı" value={fmtDuration(avgSec)} />
      </div>
      <Table head={['Tələbə', 'Qrup', 'İrəliləyiş', 'Vaxt', 'Son açılış']} empty={rows.length === 0}>
        {rows.map(({ s, v, p }) => (
          <tr key={s.id}>
            <Td><Link to={`/a/students/${s.id}`} className="font-medium text-indigo-700 hover:underline">{s.full_name}</Link></Td>
            <Td>{gName(s.group_id)}</Td>
            <Td className="w-64">
              {v ? (
                <div><div className="mb-1 text-xs text-slate-500">{v.pages.length}/{total} səhifə ({p}%)</div><Progress value={p} /></div>
              ) : <Badge color="red">Açmayıb</Badge>}
            </Td>
            <Td>{v ? fmtDuration(v.seconds) : '—'}</Td>
            <Td className="text-xs text-slate-500">{v ? fmtDate(v.last_opened) : '—'}</Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
