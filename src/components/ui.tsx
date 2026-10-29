import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
}

export function Button({
  variant = 'primary', loading, className, children, size = 'md', ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(inputCls, /\bw-/.test(p.className || '') ? '' : 'w-full', p.className)} />
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(inputCls, 'w-full', p.className)} />
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(inputCls, /\bw-/.test(p.className || '') ? '' : 'w-full', p.className)} />
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Spinner({ text = 'Yüklənir...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {text}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">{children}</div>
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Badge({ color = 'slate', children }: { color?: 'slate' | 'green' | 'amber' | 'red' | 'indigo'; children: ReactNode }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-rose-100 text-rose-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }[color]
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c)}>{children}</span>
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        {label}
        {icon && <span className="text-indigo-500">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cn('h-full rounded-full', v >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={cn('w-full rounded-xl bg-white p-6 shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Bağla">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <div className="py-10 text-center text-sm text-slate-500">Məlumat yoxdur</div>}
    </div>
  )
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
)
