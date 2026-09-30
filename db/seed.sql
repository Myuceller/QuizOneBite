-- A fixed, unreviewed local sample. Re-running never overwrites existing rows.
WITH inserted AS (
  INSERT INTO quizquiz.quizzes
    (id, category, difficulty, question_count, provider, model, prompt_version)
  VALUES
    ('98c2d9a0-6990-4d57-8c81-b31704315a48', 'general', 'easy', 3, 'mock', 'local-fixtures', 'seed-v1')
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO quizquiz.quiz_questions
  (quiz_id, id, position, question, options, correct_answer_index, explanation)
SELECT inserted.id, sample.* FROM inserted CROSS JOIN (VALUES
  ('question-1', 0, '일주일은 며칠인가요?', ARRAY['7일', '5일', '6일', '8일'], 0, '일주일은 월요일부터 일요일까지 7일입니다.'),
  ('question-2', 1, '한 시간은 몇 분인가요?', ARRAY['30분', '60분', '90분', '100분'], 1, '한 시간은 60분입니다.'),
  ('question-3', 2, '한글의 기본 모음자는 몇 개인가요?', ARRAY['8개', '14개', '10개', '24개'], 2, '현대 한글의 기본 모음자는 10개입니다.')
) AS sample(id, position, question, options, correct_answer_index, explanation);
