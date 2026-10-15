-- Snapshot the category used for historical statistics, including old sessions.
ALTER TABLE quizquiz.play_items ADD COLUMN category text;
UPDATE quizquiz.play_items i SET category=b.category FROM quizquiz.bank_questions b WHERE b.id=i.question_id;
ALTER TABLE quizquiz.play_items ALTER COLUMN category SET NOT NULL;
ALTER TABLE quizquiz.play_items ADD CONSTRAINT play_item_category CHECK (category IN ('general','science','history','geography','culture'));
CREATE INDEX play_answered_question ON quizquiz.play_items(question_id, answered_at DESC) WHERE answered_at IS NOT NULL;

CREATE TABLE quizquiz.question_bookmarks (
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quizquiz.bank_questions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, question_id)
);
CREATE INDEX bookmark_history ON quizquiz.question_bookmarks(user_id, created_at DESC);

CREATE TABLE quizquiz.daily_sets (
  day date PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quizquiz.daily_items (
  day date NOT NULL REFERENCES quizquiz.daily_sets(day),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
  question_id uuid NOT NULL REFERENCES quizquiz.bank_questions(id),
  category text NOT NULL,
  difficulty text NOT NULL,
  question text NOT NULL,
  options text[] NOT NULL CHECK (cardinality(options)=4),
  correct_answer_index smallint NOT NULL CHECK (correct_answer_index BETWEEN 0 AND 3),
  explanation text NOT NULL,
  sources jsonb NOT NULL,
  PRIMARY KEY(day, position),
  UNIQUE(day, question_id)
);
ALTER TABLE quizquiz.play_sessions
  ADD COLUMN source text NOT NULL DEFAULT 'standard' CHECK (source IN ('standard','wrong','bookmarks','daily')),
  ADD COLUMN daily_day date REFERENCES quizquiz.daily_sets(day),
  ADD CONSTRAINT daily_session CHECK ((source='daily') = (daily_day IS NOT NULL)),
  ADD CONSTRAINT learning_mode CHECK (source='standard' OR mode='standard');
CREATE UNIQUE INDEX user_daily_session ON quizquiz.play_sessions(user_id, daily_day) WHERE daily_day IS NOT NULL;
