CREATE TABLE quizquiz.bank_questions (
  id uuid PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('general','science','history','geography','culture')),
  difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
  options text[] NOT NULL CHECK (cardinality(options) = 4),
  correct_answer_index smallint NOT NULL CHECK (correct_answer_index BETWEEN 0 AND 3),
  explanation text NOT NULL CHECK (length(explanation) BETWEEN 1 AND 1000),
  sources jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(sources) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','retired')),
  provenance jsonb NOT NULL DEFAULT '{}',
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR (reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(review_note) > 0 AND jsonb_array_length(sources) > 0))
);
CREATE UNIQUE INDEX bank_question_text ON quizquiz.bank_questions (lower(regexp_replace(trim(question), '\s+', ' ', 'g'))) WHERE status <> 'retired';
CREATE INDEX bank_published ON quizquiz.bank_questions (category, difficulty) WHERE status = 'published';

CREATE TABLE quizquiz.play_sessions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  category text NOT NULL,
  difficulty text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX play_user_history ON quizquiz.play_sessions(user_id, created_at DESC);
CREATE TABLE quizquiz.play_items (
  session_id uuid NOT NULL REFERENCES quizquiz.play_sessions(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  question_id uuid NOT NULL REFERENCES quizquiz.bank_questions(id),
  question text NOT NULL,
  options text[] NOT NULL CHECK (cardinality(options) = 4),
  correct_answer_index smallint NOT NULL CHECK (correct_answer_index BETWEEN 0 AND 3),
  explanation text NOT NULL,
  sources jsonb NOT NULL,
  is_review boolean NOT NULL DEFAULT false,
  selected_index smallint CHECK (selected_index BETWEEN 0 AND 3),
  answered_at timestamptz,
  PRIMARY KEY(session_id, position),
  UNIQUE(session_id, question_id),
  CHECK ((selected_index IS NULL) = (answered_at IS NULL))
);
CREATE INDEX play_question ON quizquiz.play_items(question_id, session_id);
CREATE TABLE quizquiz.question_ratings (
  question_id uuid NOT NULL REFERENCES quizquiz.bank_questions(id),
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1,1)),
  reason text CHECK (reason IN ('obvious','ambiguous','options')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(question_id, user_id),
  CHECK ((value = 1 AND reason IS NULL) OR (value = -1 AND reason IS NOT NULL))
);
CREATE TABLE quizquiz.question_reports (
  question_id uuid NOT NULL REFERENCES quizquiz.bank_questions(id),
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('answer','explanation','ambiguous')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(question_id, user_id)
);
CREATE INDEX open_question_reports ON quizquiz.question_reports(question_id) WHERE status = 'open';
CREATE TABLE quizquiz.play_limits (
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  action text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL CHECK(count > 0),
  PRIMARY KEY(user_id, action)
);
