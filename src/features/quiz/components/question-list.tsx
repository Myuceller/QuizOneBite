import type { QuizPreview } from "../domain/quiz";

export function QuestionList({ quiz }: { quiz: QuizPreview }) {
  return <ol className="question-list" aria-label="미리보기 문제">
    {quiz.questions.map((question, questionIndex) => <li className="question-card" key={question.id}>
      <p className="question-number">문제 {String(questionIndex + 1).padStart(2, "0")}</p>
      <h3>{question.question}</h3>
      <ol className="option-list" aria-label="보기">{question.options.map((option, optionIndex) => <li key={`${question.id}-${optionIndex}`}>
        <span className="option-number" aria-hidden="true">{optionIndex + 1}</span><span>{option}</span>
      </li>)}</ol>
    </li>)}
  </ol>;
}
