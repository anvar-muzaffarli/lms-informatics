import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, BookOpen, ClipboardList, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'

const adminNav = [
  { to: '/a', label: 'İdarə paneli', icon: LayoutDashboard, end: true },
  { to: '/a/students', label: 'Tələbələr', icon: Users },
  { to: '/a/materials', label: 'Materiallar', icon: FileText },
  { to: '/a/tests', label: 'Testlər', icon: ClipboardList },
]
const studentNav = [
  { to: '/s', label: 'Ana səhifə', icon: BookOpen, end: true },
  { to: '/s/results', label: 'Nəticələrim', icon: BarChart3 },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = profile?.role === 'admin' ? adminNav : studentNav

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <div className="flex items-center gap-2 font-bold text-indigo-700">
            <GraduationCap className="h-6 w-6" /> <span>İnformatika</span>
          </div>
          <nav className="ml-4 hidden gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800">{profile?.full_name}</div>
              <div className="text-xs text-slate-500">{profile?.role === 'admin' ? 'Admin' : profile?.login}</div>
            </div>
            <button onClick={signOut} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 cursor-pointer" title="Çıxış">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Çıxış</span>
            </button>
            <button className="rounded-lg p-1.5 hover:bg-slate-100 md:hidden cursor-pointer" onClick={() => setOpen(!open)} aria-label="Menyu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-slate-100 px-4 py-2 md:hidden">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600')}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
