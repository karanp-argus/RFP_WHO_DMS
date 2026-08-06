/**
 * App shell. Content padding matches _layout.scss `.content`:
 *   padding: 110px 40px 80px 300px  (desktop)
 *   left/right padding collapse below 767px
 *
 * Redirects to the mock SSO screen when no session exists (UC006).
 */

import { Navigate, Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/stores/authStore'

export function AppShell() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-who-page-bg">
      <Sidebar />
      <Header />
      <main className="px-4 pt-content-top pb-20 md:pr-10 md:pl-content-left">
        <Outlet />
      </main>
    </div>
  )
}
