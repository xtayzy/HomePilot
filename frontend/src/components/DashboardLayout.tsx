import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  CalendarRange,
  CreditCard,
  LogOut,
  Sparkles,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAuthenticated, user } = useAuth()

  useEffect(() => {
    if (isAuthenticated === false) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
      return
    }
    if (user?.role === 'executor') {
      navigate('/executor', { replace: true })
    }
  }, [isAuthenticated, user?.role, navigate, location.pathname])

  if (isAuthenticated === false) {
    return null
  }

  const sidebarItems = [
    { icon: LayoutDashboard, label: 'Обзор', path: '/dashboard' },
    { icon: CalendarRange, label: 'Настройка слотов', path: '/dashboard/slots' },
    { icon: Calendar, label: 'Мои слоты', path: '/dashboard/visits' },
    { icon: CreditCard, label: 'Подписка', path: '/dashboard/subscription' },
    { icon: User, label: 'Профиль', path: '/dashboard/profile' },
  ] as const

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream-50 flex">
      <aside className="w-64 lg:w-72 bg-white border-r border-cream-200 hidden md:flex flex-col fixed h-full z-10 shrink-0">
        <div className="p-6 lg:p-8 border-b border-cream-100">
          <Link
            to="/"
            className="flex items-center gap-2 font-serif font-bold text-2xl text-forest-900"
          >
            <div className="bg-forest-900 p-2 rounded-full text-cream-50">
              <Sparkles className="w-5 h-5" />
            </div>
            HomePilot
          </Link>
        </div>
        <nav className="flex-1 p-4 lg:p-6 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link to={item.path} key={item.path} className="block min-w-0">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-4 font-medium h-12 rounded-xl text-base px-4 lg:px-6',
                    isActive
                      ? 'bg-forest-50 text-forest-900'
                      : 'text-stone-500 hover:bg-cream-100 hover:text-stone-900'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 lg:p-6 border-t border-cream-100 shrink-0 space-y-1">
          <Link
            to="/"
            className="flex w-full items-center gap-4 rounded-xl px-4 lg:px-6 h-11 text-sm text-stone-500 hover:bg-cream-100 hover:text-stone-700 transition-colors"
          >
            На главную
          </Link>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-4 text-stone-500 hover:text-red-600 hover:bg-red-50 h-12 rounded-xl"
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 w-full bg-white border-b border-cream-200 z-50 px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between safe-area-pt">
        <Link
          to="/"
          className="flex items-center gap-2 font-serif font-bold text-lg sm:text-xl text-forest-900 min-w-0"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="truncate">HomePilot</span>
        </Link>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 z-50 flex justify-around items-center py-2 safe-area-pb">
        <Link
          to="/dashboard"
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            location.pathname === '/dashboard' ? 'text-forest-700' : 'text-stone-500'
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-xs">Обзор</span>
        </Link>
        <Link
          to="/dashboard/slots"
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            location.pathname === '/dashboard/slots' ? 'text-forest-700' : 'text-stone-500'
          )}
        >
          <CalendarRange className="w-5 h-5" />
          <span className="text-xs">Настройка слотов</span>
        </Link>
        <Link
          to="/dashboard/visits"
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            location.pathname === '/dashboard/visits' ? 'text-forest-700' : 'text-stone-500'
          )}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-xs">Визиты</span>
        </Link>
        <Link
          to="/dashboard/subscription"
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            location.pathname === '/dashboard/subscription' ? 'text-forest-700' : 'text-stone-500'
          )}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-xs">Подписка</span>
        </Link>
        <Link
          to="/dashboard/profile"
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            location.pathname === '/dashboard/profile' ? 'text-forest-700' : 'text-stone-500'
          )}
        >
          <User className="w-5 h-5" />
          <span className="text-xs">Профиль</span>
        </Link>
      </nav>

      <main className="flex-1 md:ml-64 lg:ml-72 p-4 sm:p-6 md:p-8 pt-24 sm:pt-28 md:pt-12 pb-24 md:pb-12 max-w-7xl mx-auto w-full min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
