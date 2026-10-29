import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Eye, FileText, Pencil, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import type { Group, Material, MaterialView } from '../../lib/types'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageTitle, Spinner, Textarea } from '../../components/ui'
import GroupPicker from '../../components/GroupPicker'
import { countPdfPages } from '../../lib/pdf'
import { fmtDate, fmtDuration } from '../../lib/utils'

export default function AdminMaterials() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [m, g, mg, v] = await Promise.all([
      supabase.from('materials').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('*').order('name'),
      supabase.from('material_groups').select('*'),
      supabase.from('material_views').select('material_id,seconds'),
    ])
    return {
      materials: must(m) as Material[],
      groups: must(g) as Group[],
      links: must(mg) as { material_id: string; group_id: string }[],
      views: must(v) as Pick<MaterialView, 'material_id' | 'seconds'>[],
    }
  })
  const [edit, setEdit] = useState<Material | 'new' | null>(null)

  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox>{error}</ErrorBox>

  const remove = async (m: Material) => {
    if (!confirm(`"${m.title}" silinsin? Oxuma statistikası da silinəcək.`)) return
    await supabase.storage.from('materials').remove([m.file_path])
    await supabase.from('materials').delete().eq('id', m.id)
    reload()
  }

  return (
    <div>
      <PageTitle title="Dərs materialları" subtitle="PDF faylları yükləyin və qruplara təyin edin" actions={<Button onClick={() => setEdit('new')}><Upload className="h-4 w-4" /> PDF yüklə</Button>} />
      {data.materials.length === 0 ? (
        <Empty>Hələ material yoxdur. "PDF yüklə" düyməsi ilə başlayın.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.materials.map((m) => {
            const gids = data.links.filter((l) => l.material_id === m.id).map((l) => l.group_id)
            const vs = data.views.filter((v) => v.material_id === m.id)
            return (
              <Card key={m.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-rose-50 p-2 text-rose-600"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{m.title}</h3>
                    {m.topic && <div className="text-xs text-indigo-600">{m.topic}</div>}
                    <div className="text-xs text-slate-500">{m.page_count} səhifə · {fmtDate(m.created_at)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {gids.length === 0 && <Badge color="red">Heç bir qrupa təyin edilməyib</Badge>}
                  {gids.map((g) => <Badge key={g} color="indigo">{data.groups.find((x) => x.id === g)?.name}</Badge>)}
                </div>
                <div className="mt-3 text-sm text-slate-600">{vs.length} tələbə açıb · {fmtDuration(vs.reduce((s, v) => s + v.seconds, 0))}</div>
                <div className="mt-auto flex gap-1 pt-4">
                  <Link to={`/a/materials/${m.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                    <BarChart3 className="h-4 w-4" /> Statistika
                  </Link>
                  <Link to={`/a/material/${m.id}/view`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Bax"><Eye className="h-4 w-4" /></Link>
                  <Button variant="ghost" size="sm" onClick={() => setEdit(m)} title="Redaktə et"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(m)} title="Sil"><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {edit && (
        <MaterialModal
          material={edit === 'new' ? null : edit}
          groups={data.groups}
          initialGroups={edit === 'new' ? [] : data.links.filter((l) => l.material_id === edit.id).map((l) => l.group_id)}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); reload() }}
        />
      )}
    </div>
  )
}

function MaterialModal({ material, groups, initialGroups, onClose, onSaved }: {
  material: Material | null; groups: Group[]; initialGroups: string[]; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState(material?.title || '')
  const [topic, setTopic] = useState(material?.topic || '')
  const [description, setDescription] = useState(material?.description || '')
  const [file, setFile] = useState<File | null>(null)
  const [gids, setGids] = useState<string[]>(initialGroups)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      let id = material?.id
      if (!material) {
        if (!file) throw new Error('PDF faylı seçin')
        if (file.type !== 'application/pdf') throw new Error('Yalnız PDF faylı yükləmək olar')
        if (file.size > 50 * 1024 * 1024) throw new Error('Fayl 50 MB-dan böyük ola bilməz')
        const page_count = await countPdfPages(file)
        const path = `${crypto.randomUUID()}.pdf`
        const up = await supabase.storage.from('materials').upload(path, file, { contentType: 'application/pdf' })
        if (up.error) throw new Error(up.error.message)
        const row = must(await supabase.from('materials').insert({ title, topic: topic || null, description: description || null, file_path: path, page_count }).select('id').single()) as { id: string }
        id = row.id
      } else {
        must(await supabase.from('materials').update({ title, topic: topic || null, description: description || null }).eq('id', material.id).select())
        await supabase.from('material_groups').delete().eq('material_id', material.id)
      }
      if (gids.length) must(await supabase.from('material_groups').insert(gids.map((g) => ({ material_id: id, group_id: g }))).select())
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={material ? 'Materialı redaktə et' : 'Yeni material'}>
      <div className="space-y-3">
        {!material && (
          <Field label="PDF faylı" hint="Maksimum 50 MB">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setFile(f)
                if (f && !title) setTitle(f.name.replace(/\.pdf$/i, ''))
              }}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700"
            />
          </Field>
        )}
        <Field label="Başlıq"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Mövzu"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Məs: Say sistemləri" /></Field>
        <Field label="Qısa təsvir"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Hansı qruplar görsün?"><GroupPicker groups={groups} value={gids} onChange={setGids} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} loading={busy} disabled={!title.trim()}>Saxla</Button>
        </div>
      </div>
    </Modal>
  )
}
