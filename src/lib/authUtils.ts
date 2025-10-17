export function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /^401: .*Unauthorized/.test(error.message) ||
    /^302: .*Found/.test(error.message) ||
    error.message.includes('redirect') ||
    error.message.includes('login');
}