export class ChainError extends Error {
  readonly technical?: string;

  constructor(message: string, technical?: string) {
    super(message);
    this.name = "ChainError";
    this.technical = technical;
  }
}
