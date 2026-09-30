CREATE TABLE quizquiz.quizzes (
  id uuid PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('general', 'science', 'history', 'geography', 'culture')),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count smallint NOT NULL CHECK (question_count BETWEEN 1 AND 5),
  provider text NOT NULL CHECK (provider IN ('mock', 'openai')),
  model text NOT NULL CHECK (length(btrim(model)) > 0),
  prompt_version text NOT NULL CHECK (length(btrim(prompt_version)) > 0),
  verification_status text NOT NULL DEFAULT 'unreviewed' CHECK (verification_status = 'unreviewed'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quizquiz.quiz_questions (
  quiz_id uuid NOT NULL REFERENCES quizquiz.quizzes(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (length(btrim(id)) > 0),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
  question text NOT NULL CHECK (length(btrim(question)) BETWEEN 1 AND 500),
  options text[] NOT NULL CHECK (
    array_ndims(options) = 1 AND array_lower(options, 1) = 1
    AND cardinality(options) = 4 AND array_position(options, NULL) IS NULL
    AND length(btrim(options[1])) BETWEEN 1 AND 200
    AND length(btrim(options[2])) BETWEEN 1 AND 200
    AND length(btrim(options[3])) BETWEEN 1 AND 200
    AND length(btrim(options[4])) BETWEEN 1 AND 200
  ),
  correct_answer_index smallint NOT NULL CHECK (correct_answer_index BETWEEN 0 AND 3),
  explanation text NOT NULL CHECK (length(btrim(explanation)) BETWEEN 1 AND 1000),
  PRIMARY KEY (quiz_id, id),
  UNIQUE (quiz_id, position)
);

CREATE INDEX quizzes_category_difficulty_created_idx
  ON quizquiz.quizzes (category, difficulty, created_at DESC);

COMMENT ON TABLE quizquiz.quizzes IS 'Immutable generation drafts, not gameplay sessions or fact-checked questions.';
COMMENT ON TABLE quizquiz.quiz_questions IS 'Server-only answer keys; return public previews through an explicit DTO.';
