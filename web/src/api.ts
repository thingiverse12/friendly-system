import type {
  AchievementsResponse,
  CompetitionDetail,
  CompetitionsResponse,
  DashboardData,
  Goal,
  GoalDetailResponse,
  GroupDetail,
  GroupSummary,
  InvitationMetadata,
  LeaderboardResponse,
  MeResponse,
  MovementResult,
  ProfileStats,
  RecurrenceInterval,
  RecurringResponse,
  RecurringRule,
  Transaction,
  User,
} from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  issues: Array<{ field: string; message: string }>;

  constructor(status: number, code: string, message: string, issues: Array<{ field: string; message: string }> = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

let csrfToken: string | null = readCookie('sparly_csrf');

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken ?? readCookie('sparly_csrf');
}

async function request<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = getCsrfToken() ?? '';
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Kunde inte nå servern. Kontrollera din anslutning.');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    // The session expired or was revoked: let the auth provider drop back to the login screen.
    window.dispatchEvent(new Event('sparly:unauthorized'));
  }
  if (!response.ok) {
    const payload = data as { error?: { code?: string; message?: string; details?: { issues?: Array<{ field: string; message: string }> } } } | null;
    const issues = payload?.error?.details?.issues ?? [];
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'error',
      payload?.error?.message ?? 'Något gick fel. Försök igen.',
      issues,
    );
  }
  return data as T;
}

export interface GoalListResponse {
  goals: Goal[];
  totals: { savedOre: number; targetOre: number };
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
}

export const api = {
  me: () => request<MeResponse>('/auth/me'),
  csrf: () => request<{ csrfToken: string }>('/auth/csrf'),

  /**
   * Exchanges a Supabase access token for an app session. The only login path: credentials never
   * travel to this API.
   */
  session: (body: {
    accessToken: string;
    alias?: string;
    timezone?: string;
    publicCompetitionConsent?: boolean;
    shareBadges?: boolean;
  }) => request<{ user: User; csrfToken: string; created: boolean }>('/auth/session', { method: 'POST', body }),

  logout: () => request<{ ok: boolean; csrfToken: string }>('/auth/logout', { method: 'POST' }),

  profile: () => request<{ user: User; stats: ProfileStats }>('/profile'),

  updateProfile: (body: Partial<{ alias: string; timezone: string; publicCompetitionConsent: boolean; shareBadges: boolean }>) =>
    request<{ user: User }>('/profile', { method: 'PATCH', body }),

  deleteAccount: (confirmation: string, accessToken: string) =>
    request<{ ok: boolean; message: string }>('/profile/account', {
      method: 'DELETE',
      body: { confirmation, accessToken },
    }),

  dashboard: () => request<DashboardData>('/dashboard'),

  goals: (includeArchived = false) =>
    request<GoalListResponse>(`/goals?includeArchived=${includeArchived ? '1' : '0'}`),
  goal: (id: string) => request<GoalDetailResponse>(`/goals/${id}`),
  createGoal: (body: { name: string; targetAmountOre: number; privacy: string }) =>
    request<{ goal: Goal }>('/goals', { method: 'POST', body }),
  updateGoal: (id: string, body: Partial<{ name: string; targetAmountOre: number; privacy: string }>) =>
    request<{ goal: Goal }>(`/goals/${id}`, { method: 'PATCH', body }),
  archiveGoal: (id: string) => request<{ goal: Goal }>(`/goals/${id}/archive`, { method: 'POST' }),
  unarchiveGoal: (id: string) => request<{ goal: Goal }>(`/goals/${id}/unarchive`, { method: 'POST' }),
  deleteGoal: (id: string) => request<{ ok: boolean }>(`/goals/${id}`, { method: 'DELETE' }),
  addMovement: (id: string, body: { type: 'deposit' | 'withdrawal'; amountOre: number; note?: string }) =>
    request<MovementResult>(`/goals/${id}/movements`, { method: 'POST', body }),

  transactions: (params: Record<string, string | number | undefined> = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    return request<TransactionListResponse>(`/transactions?${search.toString()}`);
  },
  recurring: () => request<RecurringResponse>('/recurring'),
  createRecurring: (body: {
    type: 'income' | 'expense';
    amountOre: number;
    category: string;
    description?: string;
    interval: RecurrenceInterval;
    startDate?: string;
    dayOfMonth?: number;
    weekday?: number;
    endMonth?: string | null;
  }) => request<{ rule: RecurringRule }>('/recurring', { method: 'POST', body }),
  updateRecurring: (
    id: string,
    body: Partial<{
      type: 'income' | 'expense';
      amountOre: number;
      category: string;
      description: string | null;
      interval: RecurrenceInterval;
      startDate: string;
      dayOfMonth: number;
      weekday: number;
      endMonth: string | null;
      active: boolean;
    }>,
  ) => request<{ rule: RecurringRule }>(`/recurring/${id}`, { method: 'PATCH', body }),
  deleteRecurring: (id: string) => request<{ ok: boolean }>(`/recurring/${id}`, { method: 'DELETE' }),

  createTransaction: (body: {
    type: 'income' | 'expense';
    amountOre: number;
    category: string;
    description?: string;
    goalId?: string | null;
    occurredAt?: string;
  }) => request<{ transaction: Transaction }>('/transactions', { method: 'POST', body }),
  updateTransaction: (id: string, body: Record<string, unknown>) =>
    request<{ transaction: Transaction }>(`/transactions/${id}`, { method: 'PATCH', body }),
  deleteTransaction: (id: string) => request<{ ok: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),
  transactionSummary: (month?: string) =>
    request<{ month: string; incomeOre: number; expenseOre: number; netOre: number; byCategory: Array<{ category: string; type: string; totalOre: number }> }>(
      `/transactions/summary${month ? `?month=${month}` : ''}`,
    ),

  achievements: () => request<AchievementsResponse>('/achievements'),

  competitions: () => request<CompetitionsResponse>('/competitions'),
  competition: (id: string) => request<CompetitionDetail>(`/competitions/${id}`),
  leaderboard: (id: string) => request<LeaderboardResponse>(`/competitions/${id}/leaderboard`),
  joinCompetition: (id: string, goalId: string) =>
    request<{ ok: boolean; joinedActive: boolean; participant: { classCode: string | null; classLabel: string | null } }>(
      `/competitions/${id}/join`,
      { method: 'POST', body: { goalId } },
    ),
  withdrawCompetition: (id: string) =>
    request<{ ok: boolean }>(`/competitions/${id}/withdraw`, { method: 'POST' }),

  groups: () => request<{ groups: GroupSummary[] }>('/groups'),
  group: (id: string) => request<GroupDetail>(`/groups/${id}`),
  createGroup: (name: string) =>
    request<{ group: { id: string; name: string }; role: string }>('/groups', { method: 'POST', body: { name } }),
  joinGroup: (code: string) =>
    request<{ ok: boolean; groupId: string; groupName: string; alreadyMember: boolean; message: string }>('/groups/join', {
      method: 'POST',
      body: { code },
    }),
  leaveGroup: (id: string) =>
    request<{ ok: boolean; groupDeleted: boolean; newOwnerId: string | null }>(`/groups/${id}/leave`, { method: 'POST' }),
  createInvitation: (id: string, body: { maxUses: number; expiresInHours: number | null; label?: string }) =>
    request<{ invitation: { id: string; code: string; expiresAt: string | null; maxUses: number }; notice: string }>(
      `/groups/${id}/invitations`,
      { method: 'POST', body },
    ),
  revokeInvitation: (groupId: string, invitationId: string) =>
    request<{ ok: boolean }>(`/groups/${groupId}/invitations/${invitationId}`, { method: 'DELETE' }),
  createGroupCompetition: (groupId: string, body: { name: string; durationDays: 7 | 30; startsInHours: number; description?: string }) =>
    request<{ competition: { id: string; name: string } }>(`/groups/${groupId}/competitions`, { method: 'POST', body }),
};
