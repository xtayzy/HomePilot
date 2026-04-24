import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { listExecutorVisits, type ExecutorVisitItem } from '@/api/client'

function formatTime(s: string): string {
  if (!s) return '—'
  return s.split(':').slice(0, 2).join(':')
}

function formatDate(s: string): string {
  if (!s) return '—'
  const d = new Date(s + 'Z')
  const months = 'янв фев мар апр май июн июл авг сен окт ноя дек'.split(' ')
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    scheduled: 'Запланирован',
    in_progress: 'В процессе',
    completed: 'Выполнен',
    cancelled: 'Отменён',
    no_show: 'Неявка',
    rescheduled: 'Перенесён',
  }
  return map[s] || s
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekEndISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function monthStartISO(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function monthEndISO(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return d.toISOString().slice(0, 10)
}

function thirtyDaysAgoISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export function ExecutorVisitsPage() {
  const [visits, setVisits] = useState<ExecutorVisitItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'month'>('month')

  useEffect(() => {
    let cancelled = false
    const today = todayISO()
    const monthEnd = monthEndISO()
    const weekEnd = weekEndISO()
    const to = monthEnd >= weekEnd ? monthEnd : weekEnd
    const from = period === 'today' ? today : thirtyDaysAgoISO()
    const dateTo = period === 'today' ? today : to
    listExecutorVisits({ date_from: from, date_to: dateTo })
      .then((list) => {
        if (!cancelled) setVisits(list ?? [])
      })
      .catch(() => {
        if (!cancelled) setVisits([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-stone-500">Загрузка…</p>
      </div>
    )
  }

  const today = todayISO()
  const monthStart = monthStartISO()
  const monthEnd = monthEndISO()
  const filtered =
    period === 'today'
      ? visits.filter((v) => v.scheduled_date === today)
      : visits.filter((v) => v.scheduled_date >= monthStart && v.scheduled_date <= monthEnd)

  const upcoming = filtered.filter((v) => v.status !== 'completed' && v.status !== 'cancelled' && v.status !== 'no_show')
  const past = filtered.filter((v) => v.status === 'completed' || v.status === 'cancelled' || v.status === 'no_show')

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-serif font-medium text-forest-950">
          Мои визиты
        </h1>
        <div className="flex gap-2">
          <Button
            variant={period === 'today' ? 'default' : 'outline'}
            size="sm"
            className={period === 'today' ? 'bg-forest-900' : ''}
            onClick={() => setPeriod('today')}
          >
            Сегодня
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            className={period === 'month' ? 'bg-forest-900' : ''}
            onClick={() => setPeriod('month')}
          >
            Месяц
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-cream-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-medium">Нет визитов</p>
            <p className="text-sm text-stone-500 mt-2">
              {period === 'today'
                ? 'На сегодня визитов не запланировано.'
                : 'За этот период визитов нет.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-forest-900 mb-4">Предстоящие</h2>
              <div className="grid gap-4">
                {upcoming.map((visit) => (
                  <Link key={visit.id} to={`/executor/visits/${visit.id}`}>
                    <Card className="border-cream-200 shadow-sm hover:shadow-md transition-all hover:border-forest-200">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                              <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-medium text-forest-950">
                                {formatDate(visit.scheduled_date)} • {formatTime(visit.time_slot_start)} – {formatTime(visit.time_slot_end)}
                              </p>
                              {visit.address && (
                                <p className="text-sm text-stone-500 mt-1 flex items-center gap-2">
                                  <MapPin className="w-4 h-4 shrink-0" />
                                  {visit.address}
                                </p>
                              )}
                              {visit.client_phone && (
                                <p className="text-sm text-stone-500 flex items-center gap-2">
                                  <Phone className="w-4 h-4 shrink-0" />
                                  {visit.client_phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium shrink-0 ${
                              visit.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-forest-100 text-forest-800'
                            }`}
                          >
                            {statusLabel(visit.status)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-stone-600 mb-4">Выполненные</h2>
              <div className="grid gap-4">
                {past.map((visit) => (
                  <Card
                    key={visit.id}
                    className="border-cream-200 shadow-sm opacity-80"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center shrink-0">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-700">
                              {formatDate(visit.scheduled_date)} • {formatTime(visit.time_slot_start)} – {formatTime(visit.time_slot_end)}
                            </p>
                            {visit.address && (
                              <p className="text-sm text-stone-500 mt-1">{visit.address}</p>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-stone-100 text-stone-600 shrink-0">
                          {statusLabel(visit.status)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
