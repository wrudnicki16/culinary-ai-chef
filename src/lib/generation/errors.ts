// Thrown when a generation job is cancelled mid-flight. Lives in its own module so
// both the worker and openai.ts (the generation path) can import it without a cycle.
export class GenerationCancelledError extends Error {
  constructor(message = 'Generation cancelled') {
    super(message);
    this.name = 'GenerationCancelledError';
  }
}
