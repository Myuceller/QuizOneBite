CREATE TABLE quizquiz.question_submissions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  bank_question_id uuid REFERENCES quizquiz.bank_questions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer text,
  review_note text,
  UNIQUE(user_id, request_id),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND reviewer IS NULL AND review_note IS NULL AND bank_question_id IS NULL)
    OR (status = 'rejected' AND reviewed_at IS NOT NULL AND reviewer IS NOT NULL AND review_note IS NOT NULL AND length(reviewer)>0 AND length(review_note)>0 AND bank_question_id IS NULL)
    OR (status = 'approved' AND reviewed_at IS NOT NULL AND reviewer IS NOT NULL AND review_note IS NOT NULL AND length(reviewer)>0 AND length(review_note)>0 AND bank_question_id IS NOT NULL))
);
CREATE INDEX submission_user_history ON quizquiz.question_submissions(user_id, created_at DESC);
CREATE INDEX submission_review_queue ON quizquiz.question_submissions(created_at) WHERE status='pending';
