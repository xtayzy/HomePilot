import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Введите email и пароль.')
      return
    }
    setLoading(true)
    try {
      const user = await login({ email: email.trim(), password })
      navigate(user?.role === 'executor' ? '/executor' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-6 sm:space-y-8 min-w-0">
        <div className="text-center space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-forest-900 mb-4 sm:mb-6"
          >
            <div className="bg-forest-900 p-1.5 sm:p-2 rounded-full text-cream-50 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            HomePilot
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif font-medium text-forest-950">С возвращением</h1>
          <p className="text-sm sm:text-base text-stone-500">Введите данные для входа в аккаунт</p>
        </div>

        <Card className="border-none shadow-2xl shadow-forest-900/5 bg-white rounded-xl sm:rounded-2xl overflow-hidden">
          <CardContent className="p-5 sm:p-6 md:p-8 lg:p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-stone-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 rounded-xl border-stone-200 focus:ring-forest-900 bg-cream-50/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-stone-700">
                    Пароль
                  </label>
                  <Link
                    to="#"
                    className="text-sm font-medium text-forest-800 hover:text-forest-600 hover:underline"
                  >
                    Забыли пароль?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-xl border-stone-200 focus:ring-forest-900 bg-cream-50/50"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-forest-900 hover:bg-forest-800 text-cream-50 rounded-xl text-base shadow-lg shadow-forest-900/20"
              >
                {loading ? 'Вход…' : 'Войти'} <ArrowRight className="ml-2 w-4 h-4 inline" />
              </Button>
            </form>
            <div className="mt-8 pt-6 border-t border-stone-100 text-center text-sm text-stone-500">
              Нет аккаунта?{' '}
              <Link to="/register" className="font-medium text-forest-900 hover:text-forest-700 hover:underline">
                Создать аккаунт
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-stone-400">
          Входя в систему, вы соглашаетесь с нашими Условиями использования и Политикой конфиденциальности.
        </p>
      </div>
    </div>
  )
}
