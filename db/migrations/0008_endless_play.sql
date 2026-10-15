ALTER TABLE quizquiz.play_sessions
  ADD COLUMN mode text NOT NULL DEFAULT 'standard' CHECK (mode IN ('standard', 'endless'));

-- Endless sessions may revisit questions after exhausting the available bank.
ALTER TABLE quizquiz.play_items
  ALTER COLUMN position TYPE integer,
  DROP CONSTRAINT play_items_position_check,
  ADD CONSTRAINT play_items_position_check CHECK (position >= 0),
  DROP CONSTRAINT play_items_session_id_question_id_key;
CREATE INDEX play_session_questions ON quizquiz.play_items (session_id, question_id);
