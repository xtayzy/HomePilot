import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { BrandLockup } from '@/components/BrandLogo'
import { registerExecutor, setAuthTokens } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'

export function RegisterExecutorPage() {
  const { setUser } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const c = searchParams.get('code')
    if (c) setInviteCode(c)
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!inviteCode.trim() || !email.trim() || !password) {
      setError('Заполните код приглашения, email и пароль.')
      return
    }
    setLoading(true)
    try {
      const data = await registerExecutor({
        invite_code: inviteCode.trim(),
        email: email.trim(),
        password,
        name: name.trim() || null,
      })
      setAuthTokens(data.access_token, data.refresh_token, data.user)
      setUser(data.user)
      navigate('/executor', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <BrandLockup className="inline-flex justify-center text-xl" />
          <h1 className="text-3xl font-serif font-medium text-forest-950">Регистрация исполнителя</h1>
          <p className="text-sm text-stone-500">Введите код из приглашения администратора</p>
        </div>
        <Card className="border-none shadow-xl bg-white rounded-2xl">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="invite" className="text-sm font-medium text-stone-700">
                  Код приглашения
                </label>
                <Input
                  id="invite"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-stone-700">
                  Имя
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-stone-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-stone-700">
                  Пароль (мин. 8 символов)
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-12 rounded-xl"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-forest-900 hover:bg-forest-800 text-cream-50 rounded-xl"
              >
                {loading ? 'Регистрация…' : 'Создать аккаунт'} <ArrowRight className="ml-2 w-4 h-4 inline" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
