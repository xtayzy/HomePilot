/** В dev с Vite proxy используем относительный путь; иначе задайте VITE_API_BASE (например http://localhost:8001/api/v1) */
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export type LoginBody = { email: string; password: string };
export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
};

export type RegisterBody = {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  locale?: string;
};
export type RegisterResponse = { user: UserProfile; message?: string };

export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  locale?: string;
};

function getAccessToken(): string | null {
  return localStorage.getItem('hp_access_token');
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem('hp_user');
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function setAuthTokens(accessToken: string, refreshToken: string, user: UserProfile): void {
  localStorage.setItem('hp_access_token', accessToken);
  localStorage.setItem('hp_refresh_token', refreshToken);
  localStorage.setItem('hp_user', JSON.stringify(user));
}

/** Обновить только токены (при refresh), не трогая user. */
function updateTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('hp_access_token', accessToken);
  if (refreshToken !== undefined) localStorage.setItem('hp_refresh_token', refreshToken);
}

export const AUTH_CLEARED_EVENT = 'hp-auth-cleared'

export function clearAuth(): void {
  localStorage.removeItem('hp_access_token');
  localStorage.removeItem('hp_refresh_token');
  localStorage.removeItem('hp_user');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
  }
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Не удалось подключиться к серверу. Запущен ли бэкенд (порт 8001)? Открывайте сайт по http://localhost:3003.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.detail ?? data.message ?? 'Ошибка входа';
    throw new Error(typeof message === 'string' ? message : message[0]?.msg ?? 'Ошибка входа');
  }
  return data as LoginResponse;
}

export async function confirmEmail(code: string): Promise<{ message: string }> {
  let res: Response
  try {
    res = await fetch(API_BASE + '/auth/confirm-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    })
  } catch {
    throw new Error(
      'Не удалось подключиться к серверу. Запущен ли бэкенд (порт 8001)? Открывайте сайт по http://localhost:3003.'
    )
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.detail ?? data.message ?? 'Ошибка подтверждения'
    throw new Error(typeof msg === 'string' ? msg : msg[0]?.msg ?? 'Ошибка подтверждения')
  }
  return data as { message: string }
}

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  let res: Response;
  try {
    res = await fetch(API_BASE + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        phone: body.phone || null,
        locale: body.locale ?? 'ru',
      }),
    });
  } catch (e) {
    throw new Error(
      'Не удалось подключиться к серверу. Запущен ли бэкенд (порт 8001)? Открывайте сайт по http://localhost:3003.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (res.status !== 201 && res.status !== 200) {
    const message = data.detail ?? data.message ?? 'Ошибка регистрации';
    throw new Error(typeof message === 'string' ? message : message[0]?.msg ?? 'Ошибка регистрации');
  }
  return data as RegisterResponse;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('hp_refresh_token');
  if (!refreshToken) {
    clearAuth();
    return null;
  }
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        clearAuth();
        return null;
      }
      const d = data as { access_token: string; refresh_token?: string };
      const user = getStoredUser();
      if (user) {
        updateTokens(d.access_token, d.refresh_token ?? refreshToken);
      } else {
        updateTokens(d.access_token, d.refresh_token ?? refreshToken);
      }
      return d.access_token;
    } catch {
      clearAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  const isRefreshRequest = url.includes('/auth/refresh');
  let token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(input, { ...init, headers });
  if ((res.status === 403 || res.status === 401) && !isRefreshRequest) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const newHeaders = new Headers(init?.headers);
      newHeaders.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers: newHeaders });
    }
  }
  return res;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка запроса') as string);
  return data as T;
}

async function apiAuthGet<T>(path: string): Promise<T> {
  const res = await authFetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка запроса') as string);
  return data as T;
}

/** Текущий пользователь. */
export function getMe(): Promise<UserProfile> {
  return apiAuthGet<UserProfile>('/me');
}

export type MeUpdateBody = { name?: string | null; phone?: string | null; locale?: string };

/** Обновить профиль. */
export async function updateMe(body: MeUpdateBody): Promise<UserProfile> {
  const res = await authFetch(API_BASE + '/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка сохранения') as string);
  return data as UserProfile;
}

/** Смена пароля. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await authFetch(API_BASE + '/me/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка смены пароля') as string);
  return data as { message: string };
}

export type CityItem = { id: string; code: string; name: string };
export type ApartmentTypeItem = { id: string; code: string; name: string; duration_light_min: number; duration_full_min: number };
export type TariffPriceItem = { apartment_type_id: string; apartment_type_code: string | null; price_month_kzt: number };
export type TariffItem = {
  id: string; code: string; name: string; cleaning_type: string; visits_per_month: number;
  has_linen: boolean; has_plants: boolean; has_ironing: boolean; prices: TariffPriceItem[];
};

export function getCities(locale = 'ru'): Promise<CityItem[]> {
  return apiGet<CityItem[]>(`/cities?locale=${locale}`);
}
export function getApartmentTypes(locale = 'ru'): Promise<ApartmentTypeItem[]> {
  return apiGet<ApartmentTypeItem[]>(`/apartment-types?locale=${locale}`);
}
export function getTariffs(locale = 'ru'): Promise<TariffItem[]> {
  return apiGet<TariffItem[]>(`/tariffs?locale=${locale}`);
}

export type SubscriptionCreateBody = {
  tariff_id: string;
  apartment_type_id: string;
  city_id: string;
  address_street: string;
  address_building: string;
  address_flat: string;
  address_entrance?: string | null;
  address_floor?: string | null;
  address_doorcode?: string | null;
  address_comment?: string | null;
  preferred_days: number[];
  time_slot_start: string;
  time_slot_end: string;
  premium_linen?: boolean;
  premium_plants?: boolean;
  premium_ironing?: boolean;
  accept_offer: boolean;
};

export function createSubscription(body: SubscriptionCreateBody): Promise<{ id: string; [k: string]: unknown }> {
  return authFetch(API_BASE + '/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка создания подписки') as string);
    return data as { id: string; [k: string]: unknown };
  });
}

export function createPaymentIntent(subscriptionId: string): Promise<{ payment_id: string; redirect_url: string }> {
  return authFetch(API_BASE + '/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_id: subscriptionId }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка создания платежа') as string);
    return data as { payment_id: string; redirect_url: string };
  });
}

export type SubmitCardBody = {
  payment_id: string;
  card_number: string;
  exp_month: string;
  exp_year: string;
  cvc: string;
  cardholder_name?: string;
};

export function submitCard(body: SubmitCardBody): Promise<{ message: string }> {
  return authFetch(API_BASE + '/payments/simulate-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_id: body.payment_id,
      card_number: body.card_number.replace(/\D/g, ''),
      exp_month: body.exp_month.padStart(2, '0').slice(-2),
      exp_year: body.exp_year.slice(-2),
      cvc: body.cvc,
      cardholder_name: body.cardholder_name ?? '',
    }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка оплаты картой') as string);
    return data as { message: string; code: string };
  });
}

export function confirmPayment(paymentId: string, code: string): Promise<{ payment_id: string; status: string; message: string }> {
  return authFetch(API_BASE + '/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId, code: code.trim() }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка подтверждения оплаты') as string);
    return data as { payment_id: string; status: string; message: string };
  });
}

export type SubscriptionItem = {
  id: string;
  status: string;
  price_month_kzt: number | null;
  time_slot_start: string;
  time_slot_end: string;
  started_at: string | null;
  ends_at: string | null;
  preferred_days?: number[];
  address_street?: string;
  address_building?: string;
  address_flat?: string;
  /** light | full — для расчёта max длительности слота */
  tariff_cleaning_type?: string;
  apartment_type_duration_light_min?: number;
  apartment_type_duration_full_min?: number;
  [k: string]: unknown;
};

/** Список всех подписок пользователя (несколько квартир). */
export function listSubscriptions(): Promise<SubscriptionItem[]> {
  return authFetch(API_BASE + '/subscriptions').then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки подписок') as string);
    return data as SubscriptionItem[];
  });
}

/** Одна подписка по id (для обратной совместимости — «текущая»/первая). */
export type SubscriptionCurrent = SubscriptionItem;

export function getCurrentSubscription(): Promise<SubscriptionCurrent | null> {
  return authFetch(API_BASE + '/subscriptions/current').then(async (res) => {
    if (res.status === 404) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки подписки') as string);
    return data as SubscriptionCurrent;
  });
}

export function getSubscription(id: string): Promise<SubscriptionItem> {
  return authFetch(API_BASE + `/subscriptions/${id}`).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки подписки') as string);
    return data as SubscriptionItem;
  });
}

export type VisitItem = {
  id: string;
  subscription_id: string;
  executor_id: string | null;
  scheduled_date: string;
  time_slot_start: string;
  time_slot_end: string;
  status: string;
  completed_at: string | null;
  executor: { name: string | null; photo_url: string | null } | null;
};

export function listVisits(params?: { from_date?: string; to_date?: string; status?: string }): Promise<VisitItem[]> {
  const sp = new URLSearchParams();
  if (params?.from_date) sp.set('from_date', params.from_date);
  if (params?.to_date) sp.set('to_date', params.to_date);
  if (params?.status) sp.set('status', params.status);
  const qs = sp.toString();
  return apiAuthGet<VisitItem[]>(`/visits${qs ? '?' + qs : ''}`);
}

export type VisitDetailItem = VisitItem & {
  photos: { id: string; file_path: string }[];
  checklist_results: {
    checklist_item_id: string;
    done: boolean;
    title_ru: string | null;
    title_kk: string | null;
  }[];
};

export function getVisit(visitId: string): Promise<VisitDetailItem> {
  return apiAuthGet<VisitDetailItem>(`/visits/${visitId}`);
}

/** API URL для фото визита (требует авторизации). */
export function getVisitPhotoApiUrl(visitId: string, filePath: string): string {
  const filename = filePath.split('/').pop() || filePath
  return API_BASE + `/visits/${visitId}/photos/${encodeURIComponent(filename)}`
}

/** Загрузить фото визита с авторизацией и вернуть blob URL. */
export async function fetchVisitPhotoBlobUrl(visitId: string, filePath: string): Promise<string> {
  const url = getVisitPhotoApiUrl(visitId, filePath)
  const res = await authFetch(url)
  if (!res.ok) throw new Error('Не удалось загрузить фото')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export type RescheduleVisitBody = {
  new_scheduled_date: string; // YYYY-MM-DD
  new_time_slot_start: string; // HH:MM or HH:MM:SS
  new_time_slot_end: string;
};

export function rescheduleVisit(visitId: string, body: RescheduleVisitBody): Promise<{ message: string; visit_id: string }> {
  return authFetch(API_BASE + `/visits/${visitId}/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_scheduled_date: body.new_scheduled_date,
      new_time_slot_start: body.new_time_slot_start.length === 5 ? body.new_time_slot_start + ':00' : body.new_time_slot_start,
      new_time_slot_end: body.new_time_slot_end.length === 5 ? body.new_time_slot_end + ':00' : body.new_time_slot_end,
    }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка переноса визита') as string);
    return data as { message: string; visit_id: string };
  });
}

// ——— Executor API ———
export type ExecutorVisitItem = {
  id: string;
  scheduled_date: string;
  time_slot_start: string;
  time_slot_end: string;
  status: string;
  address: string | null;
  client_phone: string | null;
};

export type ExecutorVisitDetail = ExecutorVisitItem & {
  address_street: string | null;
  address_building: string | null;
  address_flat: string | null;
  address_comment: string | null;
  client_phone: string | null;
  cleaning_type: string | null;
  apartment_type: string | null;
  checklist_items: { id: string; title_ru: string; title_kk: string; sort_order: number }[];
};

export type ChecklistResultItem = {
  checklist_item_id: string;
  done: boolean;
  photo_id?: string | null;
};

export function listExecutorVisits(params?: { date_from?: string; date_to?: string }): Promise<ExecutorVisitItem[]> {
  const sp = new URLSearchParams();
  if (params?.date_from) sp.set('date_from', params.date_from);
  if (params?.date_to) sp.set('date_to', params.date_to);
  const qs = sp.toString();
  return authFetch(API_BASE + `/executor/visits${qs ? '?' + qs : ''}`).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки визитов') as string);
    return data as ExecutorVisitItem[];
  });
}

export function getExecutorVisit(visitId: string): Promise<ExecutorVisitDetail> {
  return authFetch(API_BASE + `/executor/visits/${visitId}`).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки визита') as string);
    return data as ExecutorVisitDetail;
  });
}

export function startExecutorVisit(visitId: string): Promise<{ message: string }> {
  return authFetch(API_BASE + `/executor/visits/${visitId}/start`, { method: 'POST' }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка') as string);
    return data as { message: string };
  });
}

export function completeExecutorVisit(visitId: string, results: ChecklistResultItem[]): Promise<{ message: string }> {
  return authFetch(API_BASE + `/executor/visits/${visitId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      results: results.map((r) => ({
        checklist_item_id: r.checklist_item_id,
        done: r.done,
        photo_id: r.photo_id || null,
      })),
    }),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка завершения визита') as string);
    return data as { message: string };
  });
}

export function uploadExecutorPhoto(
  visitId: string,
  file: File,
  checklistItemId?: string | null
): Promise<{ id: string; file_path: string }> {
  const fd = new FormData();
  fd.append('file', file);
  if (checklistItemId) fd.append('checklist_item_id', checklistItemId);
  return authFetch(API_BASE + `/executor/visits/${visitId}/upload-photo`, {
    method: 'POST',
    body: fd,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка загрузки фото') as string);
    return data as { id: string; file_path: string };
  });
}

export function noShowExecutorVisit(visitId: string): Promise<{ message: string }> {
  return authFetch(API_BASE + `/executor/visits/${visitId}/no-show`, { method: 'POST' }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail ?? data.message ?? 'Ошибка') as string);
    return data as { message: string };
  });
}
