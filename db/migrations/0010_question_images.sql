CREATE FUNCTION quizquiz.valid_question_image(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT value IS NULL OR COALESCE(
    jsonb_typeof(value)='object'
    AND jsonb_typeof(value->'src')='string'
    AND value->>'src' ~ '^/quiz-images/[a-f0-9]{32}\.svg$'
    AND jsonb_typeof(value->'alt')='string'
    AND length(trim(value->>'alt')) BETWEEN 1 AND 500
    AND jsonb_typeof(value->'width')='number'
    AND (value->>'width') ~ '^[1-9][0-9]{0,3}$'
    AND (value->>'width')::numeric BETWEEN 1 AND 4000
    AND jsonb_typeof(value->'height')='number'
    AND (value->>'height') ~ '^[1-9][0-9]{0,3}$'
    AND (value->>'height')::numeric BETWEEN 1 AND 4000
    AND (value - ARRAY['src','alt','width','height'])='{}'::jsonb, false);
$$;
ALTER TABLE quizquiz.bank_questions ADD COLUMN image jsonb CHECK (quizquiz.valid_question_image(image));
ALTER TABLE quizquiz.play_items ADD COLUMN image jsonb CHECK (quizquiz.valid_question_image(image));
ALTER TABLE quizquiz.daily_items ADD COLUMN image jsonb CHECK (quizquiz.valid_question_image(image));
-- The same prompt can identify different pictures. Text-only duplicates remain prohibited.
DROP INDEX quizquiz.bank_question_text;
CREATE UNIQUE INDEX bank_question_text_image ON quizquiz.bank_questions (
  lower(regexp_replace(trim(question), '\s+', ' ', 'g')), COALESCE(image->>'src','')
) WHERE status <> 'retired';
