export type GenerationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "AI_UNAVAILABLE"
  | "CONFIGURATION_ERROR";

/** Safe to expose through an API. Never attach upstream response bodies. */
export class GenerationError extends Error {
  constructor(
    public readonly code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}
