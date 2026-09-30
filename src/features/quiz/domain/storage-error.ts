export class QuizStorageError extends Error {
  constructor(
    public readonly code: "DATABASE_CONFIGURATION_ERROR" | "DATABASE_UNAVAILABLE" | "INVALID_STORED_QUIZ",
  ) {
    super(code === "DATABASE_CONFIGURATION_ERROR"
      ? "서버 DB 연결 설정이 필요해요."
      : "문제를 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    this.name = "QuizStorageError";
  }
}
