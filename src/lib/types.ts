export type Role = 'admin' | 'student'

export interface Group { id: string; name: string; created_at: string }

export interface Profile {
  id: string
  full_name: string
  login: string
  role: Role
  group_id: string | null
  created_at: string
}

export interface Material {
  id: string
  title: string
  description: string | null
  topic: string | null
  file_path: string
  page_count: number | null
  created_at: string
}

export interface MaterialView {
  user_id: string
  material_id: string
  seconds: number
  pages: number[]
  last_page: number | null
  page_count: number | null
  first_opened: string
  last_opened: string
}

export interface Test {
  id: string
  title: string
  description: string | null
  topic: string | null
  time_limit_min: number | null
  max_attempts: number | null
  questions_per_attempt: number | null
  shuffle_questions: boolean
  shuffle_options: boolean
  show_answers: boolean
  opens_at: string | null
  closes_at: string | null
  published: boolean
  created_at: string
}

export interface Question {
  id: string
  test_id: string
  position: number
  text: string
  options: string[]
  correct: number
  explanation: string | null
  topic: string | null
  image_path: string | null
}

export interface Attempt {
  id: string
  test_id: string
  user_id: string
  started_at: string
  finished_at: string | null
  question_ids: string[]
  answers: Record<string, number>
  score: number | null
  total: number | null
  tab_switches: number
}
