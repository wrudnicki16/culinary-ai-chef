export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message) || 
         /^302: .*Found/.test(error.message) ||
         error.message.includes('redirect') ||
         error.message.includes('login');
}