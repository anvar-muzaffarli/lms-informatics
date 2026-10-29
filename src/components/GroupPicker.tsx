import type { Group } from '../lib/types'
import { cn } from '../lib/utils'

export default function GroupPicker({ groups, value, onChange }: { groups: Group[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!groups.length) return <p className="text-sm text-slate-500">Əvvəlcə "Tələbələr → Qruplar" bölməsində qrup yaradın</p>
  const all = value.length === groups.length
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(all ? [] : groups.map((g) => g.id))}
        className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
      >
        {all ? 'Heç biri' : 'Hamısı'}
      </button>
      {groups.map((g) => {
        const on = value.includes(g.id)
        return (
          <button
            type="button"
            key={g.id}
            onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}
            className={cn('rounded-full border px-3 py-1 text-sm cursor-pointer', on ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}
          >
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
