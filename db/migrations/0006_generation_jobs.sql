CREATE TABLE quizquiz.generation_jobs (
  id uuid PRIMARY KEY,
  request_hash text NOT NULL,
  request jsonb NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  pricing_version text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','completed','failed')),
  reserved_micros bigint NOT NULL CHECK (reserved_micros > 0),
  charged_micros bigint NOT NULL CHECK (charged_micros >= 0),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  response_id text,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  skipped_count integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX generation_budget_month ON quizquiz.generation_jobs(created_at);
