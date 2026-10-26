export type Privacy = 'private' | 'alias_visible';
export type TransactionType = 'income' | 'expense';
export type MovementType = 'deposit' | 'withdrawal';
export type CompetitionStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface Profile {
  alias: string;
  timezone: string;
  publicCompetitionConsent: boolean;
  shareBadges: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
  profile: Profile;
}

export interface LevelInfo {
  level: number;
  name: string;
  earnedCount: number;
  nextLevelAt: number | null;
  progressToNextBps: number;
}

export interface ProfileStats {
  goalCount: number;
  activeGoalCount: number;
  totalSavedOre: number;
  totalTargetOre: number;
  achievementCount: number;
  level: LevelInfo;
  competitionCount: number;
  memberSince: string;
}

export interface MeResponse {
  authenticated: boolean;
  user?: User;
  stats?: ProfileStats;
  csrfToken: string;
  serverTime?: string;
}

export interface Milestone {
  code: string;
  name: string;
  badge: string;
  thresholdBps: number;
  reached: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmountOre: number;
  balanceOre: number;
  currency: string;
  privacy: Privacy;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  progressBps: number;
  progressPercentage: number;
  remainingOre: number;
  archived: boolean;
  milestones: Milestone[];
  lockedTarget: boolean;
  activeCompetitionCount: number;
}

export interface Movement {
  id: string;
  goalId?: string;
  type: MovementType;
  amountOre: number;
  balanceAfterOre: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface EarnedAchievement {
  code: string;
  name: string;
  description: string;
  badge: string;
  milestoneBps: number;
  goalId: string;
  earnedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amountOre: number;
  category: string;
  description: string | null;
  goalId: string | null;
  goalName: string | null;
  occurredAt: string;
  createdAt: string;
}

export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** A rule for money that comes back every week, month, quarter or year ("återkommande post"). */
export interface RecurringRule {
  id: string;
  type: TransactionType;
  amountOre: number;
  category: string;
  description: string | null;
  interval: RecurrenceInterval;
  startDate: string;
  dayOfMonth: number | null;
  weekday: number | null;
  endMonth: string | null;
  /** Null when the rule has run past its end month or is paused. */
  nextOccurrence: string | null;
  upcoming: string[];
  active: boolean;
  /** Normalised to one month, so a weekly and a yearly rule can be compared. */
  monthlyOre: number;
  timesBooked: number;
  totalBookedOre: number;
  lastBookedDate: string | null;
  createdAt: string;
}

export interface RecurringSummary {
  monthlyIncomeOre: number;
  monthlyExpenseOre: number;
  monthlyNetOre: number;
  yearlyExpenseOre: number;
  activeCount: number;
  pausedCount: number;
  bookedThisMonthOre: number;
  bookedThisMonthCount: number;
}

export interface RecurringResponse {
  rules: RecurringRule[];
  summary: RecurringSummary;
  /** Today's date in the user's timezone, `YYYY-MM-DD`. */
  today: string;
  /** How many transactions the catch-up created when this list was loaded. */
  booked: number;
}

export interface AchievementCatalogItem extends Milestone {
  description: string;
  earnedCount: number;
  earnedAt: string | null;
  goals: Array<{ goalId: string; goalName: string; earnedAt: string }>;
}

export interface AchievementsResponse {
  catalog: AchievementCatalogItem[];
  level: LevelInfo;
  levelInfo: LevelInfo;
  totalEarned: number;
  totalAwards: number;
  levels: Array<{ level: number; required: number; current: boolean }>;
}

export interface DashboardData {
  totals: {
    savedOre: number;
    targetOre: number;
    progressBps: number;
    activeGoals: number;
    transactionsThisMonth: number;
  };
  month: {
    incomeOre: number;
    expenseOre: number;
    netOre: number;
    byCategory: Array<{ category: string; type: TransactionType; totalOre: number }>;
  };
  goals: Goal[];
  nextMilestone: {
    code: string;
    name: string;
    badge: string;
    thresholdBps: number;
    currentBps: number;
    remainingOre: number;
    goalId: string;
    goalName: string;
  } | null;
  level: LevelInfo;
  achievements: { earned: number; total: number };
  competitions: { active: number; upcoming: number; joined: number };
  recentTransactions: Array<{
    id: string;
    type: TransactionType;
    amountOre: number;
    category: string;
    occurredAt: string;
    goalName: string | null;
  }>;
  serverTime: string;
}

export interface CompetitionSummary {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  visibility: 'public' | 'private';
  status: CompetitionStatus;
  startsAt: string;
  endsAt: string;
  participantCount: number;
  joined: boolean;
  participantClassCode: string | null;
  groupId: string | null;
  finalisedAt: string | null;
  myRank: number | null;
  myScore: number | null;
}

export interface LeaderboardEntry {
  rank: number | null;
  alias: string;
  score: number;
  scoreCenti: number;
  classCode: string;
  badge: string | null;
  isYou: boolean;
}

export interface MyParticipation {
  joined: boolean;
  withdrawn: boolean;
  goalId: string | null;
  classCode: string | null;
  classLabel: string | null;
  score: number | null;
  rank: number | null;
  startingBalanceOre: number | null;
  lockedTargetOre: number | null;
  snapshotFrozen: boolean;
  progressBps: number | null;
}

export interface CompetitionDetail {
  competition: {
    id: string;
    name: string;
    description: string;
    participantCount: number;
    durationDays: number;
    visibility: 'public' | 'private';
    status: CompetitionStatus;
    startsAt: string;
    endsAt: string;
    finalisedAt: string | null;
    scoringNote: string;
    scoringFormula: string;
  };
  myParticipation: MyParticipation;
  leaderboard: {
    entries: LeaderboardEntry[];
    classLabel: string | null;
    startsInSeconds: number;
    endsInSeconds: number;
    requiresConsent: boolean;
  };
  classExplanation: string;
}

export interface LeaderboardResponse {
  competitionId: string;
  status: CompetitionStatus;
  startsAt: string;
  endsAt: string;
  finalisedAt: string | null;
  scoringNote: string;
  entries: LeaderboardEntry[];
  classLabel: string | null;
  classExplanation: string;
  viewer: {
    joined: boolean;
    withdrawn: boolean;
    score: number | null;
    rank: number | null;
    classCode: string | null;
    classLabel: string | null;
  };
  classes: Array<{ code: string; label: string }>;
}

export interface CompetitionsResponse {
  public: CompetitionSummary[];
  mine: CompetitionSummary[];
  groups: Array<{ groupId: string; groupName: string; competitions: CompetitionSummary[] }>;
}

export interface GroupSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  memberCount: number;
  createdAt: string;
  competitionCount: number;
}

export interface InvitationMetadata {
  id: string;
  label: string | null;
  maxUses: number;
  usesCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'expired' | 'revoked' | 'used';
}

export interface GroupDetail {
  group: { id: string; name: string; ownerId: string; createdAt: string };
  role: 'owner' | 'member';
  members: Array<{ alias: string; role: 'owner' | 'member'; joinedAt: string; isYou: boolean }>;
  invitations: InvitationMetadata[];
  competitions: Array<{
    id: string;
    name: string;
    status: CompetitionStatus;
    durationDays: number;
    startsAt: string;
    endsAt: string;
    participantCount: number;
  }>;
}

export interface GoalDetailResponse {
  goal: Goal;
  movements: Movement[];
  achievements: AchievementCatalogItem[];
}

export interface MovementResult {
  goal: Goal;
  movement: Movement;
  newlyEarned: EarnedAchievement[];
}
