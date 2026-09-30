ALTER TABLE quizquiz.quizzes ADD COLUMN owner_id text REFERENCES public.auth_user(id) ON DELETE CASCADE;
CREATE INDEX quizzes_owner_created_idx ON quizquiz.quizzes(owner_id, created_at DESC, id DESC) WHERE owner_id IS NOT NULL;

CREATE TABLE quizquiz.preview_limits (
  user_id text PRIMARY KEY REFERENCES public.auth_user(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0)
);
