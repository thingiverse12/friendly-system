export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type QType = "mcq" | "tf" | "fill" | "numeric" | "short" | "match";
export type GameMode = "quick" | "blackjack" | "wheel" | "slots" | "highstakes" | "brainrush" | "daily" | "lesson" | "duel";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  preferred_format: "auto" | "choice" | "written" | "mixed";
  public_profile: boolean;
  show_school: boolean;
  reminders: boolean;
  /* Tillgänglighet */
  dyslexia?: boolean;
  colorblind?: "none" | "deuteranopia" | "protanopia" | "tritanopia" | "mono";
  text_size?: "normal" | "large" | "xl";
  high_contrast?: boolean;
  focus_mode?: boolean;
}

export interface Profile {
  id: string;
  alias: string;
  avatar: string;
  theme: string;
  xp: number;
  coins: number;
  role: "student" | "teacher" | "admin";
  school_id: string | null;
  class_id: string | null;
  settings: Settings;
  created_at: string;
  last_active_at: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort: number;
  active: boolean;
}

export interface PublicQuestion {
  idx: number;
  qtype: QType;
  prompt: string;
  options: string[] | { left: string[]; right: string[] } | null;
  difficulty: Difficulty;
  subject_id: string;
  source: "verified" | "ai" | "generated";
}

export interface SessionView {
  id: string;
  mode: GameMode;
  status: "active" | "finished" | "abandoned" | "bust";
  subject_id: string | null;
  difficulty: Difficulty | null;
  competitive: boolean;
  score: number;
  correct: number;
  total: number;
  answered: number;
  xp_awarded: number;
  coins_awarded: number;
  current: PublicQuestion | null;
  public_meta: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
  results?: ResultItem[];
}

export interface ResultItem {
  idx: number;
  prompt: string;
  correct: boolean | null;
  xp: number;
  explanation: string | null;
  correct_answer: string;
  your_answer: string;
}

export interface AnswerResult {
  correct: boolean;
  xp: number;
  coins: number;
  explanation: string | null;
  correct_answer: string | null;
  finished: boolean;
  session: SessionView;
  flags: string[];
  level_up?: number | null;
  achievements?: { id: string; name: string; icon: string }[];
  blackjack?: { card: number | null; hand: number[]; total: number; bust: boolean; blackjack: boolean };
  combo?: number;
  combo_bonus?: number;
  profile?: { xp: number; coins: number; level: number };
}
