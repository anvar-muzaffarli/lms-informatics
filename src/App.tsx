import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import Layout from './components/Layout'
import { Button, Card, Spinner } from './components/ui'
import Login from './pages/Login'
const StudentHome = lazy(() => import('./pages/student/StudentHome'))
const MaterialReader = lazy(() => import('./pages/student/MaterialReader'))
const TestRunner = lazy(() => import('./pages/student/TestRunner'))
const AttemptReview = lazy(() => import('./pages/student/AttemptReview'))
const MyResults = lazy(() => import('./pages/student/MyResults'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminStudents = lazy(() => import('./pages/admin/AdminStudents'))
const AdminStudentDetail = lazy(() => import('./pages/admin/AdminStudentDetail'))
const AdminMaterials = lazy(() => import('./pages/admin/AdminMaterials'))
const AdminMaterialStats = lazy(() => import('./pages/admin/AdminMaterialStats'))
const AdminTests = lazy(() => import('./pages/admin/AdminTests'))
const AdminTestEdit = lazy(() => import('./pages/admin/AdminTestEdit'))
const AdminTestResults = lazy(() => import('./pages/admin/AdminTestResults'))
import type { Role } from './lib/types'

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile)
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <p className="text-sm text-slate-700">Hesabınız üçün profil tapılmadı. Administratorla əlaqə saxlayın.</p>
          <Button className="mt-4" variant="secondary" onClick={signOut}>Çıxış</Button>
        </Card>
      </div>
    )
  if (profile.role !== role) return <Navigate to={profile.role === 'admin' ? '/a' : '/s'} replace />
  return <>{children}</>
}

function Home() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={profile?.role === 'admin' ? '/a' : '/s'} replace />
}

export default function App() {
  if (!isConfigured)
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card>
          <h1 className="text-lg font-semibold">Quraşdırma tamamlanmayıb</h1>
          <p className="mt-2 text-sm text-slate-600">
            <code>VITE_SUPABASE_URL</code> və <code>VITE_SUPABASE_ANON_KEY</code> dəyişənlərini <code>.env</code> faylına (və ya Netlify
            ayarlarına) əlavə edin. Ətraflı məlumat README faylındadır.
          </p>
        </Card>
      </div>
    )

  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/s" element={<Guard role="student"><Layout /></Guard>}>
        <Route index element={<StudentHome />} />
        <Route path="material/:id" element={<MaterialReader />} />
        <Route path="test/:id" element={<TestRunner />} />
        <Route path="attempt/:id" element={<AttemptReview />} />
        <Route path="results" element={<MyResults />} />
      </Route>
      <Route path="/a" element={<Guard role="admin"><Layout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:id" element={<AdminStudentDetail />} />
        <Route path="materials" element={<AdminMaterials />} />
        <Route path="materials/:id" element={<AdminMaterialStats />} />
        <Route path="material/:id/view" element={<MaterialReader />} />
        <Route path="tests" element={<AdminTests />} />
        <Route path="tests/:id" element={<AdminTestEdit />} />
        <Route path="tests/:id/results" element={<AdminTestResults />} />
        <Route path="attempt/:id" element={<AttemptReview />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
