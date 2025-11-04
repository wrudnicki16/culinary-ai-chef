# Authentication Enhancement Plan
## Culinary AI Chef - Multi-Provider Authentication

---

## Overview

This document outlines the plan to enhance authentication in the Culinary AI Chef application by adding multiple authentication providers beyond the current Google OAuth implementation.

### Current State
- ✅ Google OAuth (implemented)
- ✅ NextAuth v5.0.0-beta.30
- ✅ Drizzle ORM with PostgreSQL (Neon)
- ✅ User roles system in place

### Planned Additions
1. **Email/Password Authentication** (Credentials Provider)
2. **Facebook OAuth** - Recommended for food/recipe apps
3. **Apple Sign-In** - For iOS users and premium demographic
4. **GitHub OAuth** (Optional) - For developer audience

---

## Phase 1: Email/Password Authentication (Week 1)

### Database Schema Changes

Add to the `users` table:

```sql
ALTER TABLE users ADD COLUMN password TEXT;
ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
```

**Drizzle Schema Update** (`src/lib/schema.ts`):
```typescript
export const users = pgTable("users", {
  // ... existing fields
  password: text("password"), // nullable for OAuth users
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
});
```

### Required Packages

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

**Why bcryptjs?**
- Pure JavaScript (no native dependencies)
- Works in serverless environments (Vercel, AWS Lambda)
- Cross-platform compatibility
- Same security as bcrypt

### Backend Implementation

#### 1. Password Validation Schema (`src/lib/validations/auth.ts`)

```typescript
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain uppercase letter")
  .regex(/[a-z]/, "Must contain lowercase letter")
  .regex(/[0-9]/, "Must contain number")
  .regex(/[^A-Za-z0-9]/, "Must contain special character");

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
```

#### 2. Credentials Provider (`src/lib/auth.ts`)

```typescript
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"

providers: [
  GoogleProvider({ /* existing */ }),
  CredentialsProvider({
    id: "credentials",
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Email and password required")
      }

      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, credentials.email)
      })

      if (!user || !user.password) {
        throw new Error("Invalid credentials")
      }

      // Verify password
      const isValid = await bcrypt.compare(
        credentials.password,
        user.password
      )

      if (!isValid) {
        throw new Error("Invalid credentials")
      }

      // Check email verification
      if (!user.emailVerified) {
        throw new Error("Please verify your email first")
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      }
    }
  })
]
```

#### 3. Sign Up API Route (`src/app/api/auth/signup/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { users } from "@/lib/schema"
import { signUpSchema } from "@/lib/validations/auth"
import { eq } from "drizzle-orm"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = signUpSchema.parse(body)

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validated.email)
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password (12 rounds)
    const hashedPassword = await bcrypt.hash(validated.password, 12)

    // Create user
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email: validated.email,
      password: hashedPassword,
      firstName: validated.firstName,
      lastName: validated.lastName,
      name: `${validated.firstName} ${validated.lastName}`,
      roles: ["user"],
    }).returning()

    // TODO: Send verification email

    return NextResponse.json({
      success: true,
      message: "Account created. Please check email to verify."
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

### Security Features

#### Password Hashing
```typescript
const SALT_ROUNDS = 12;
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
const isValid = await bcrypt.compare(password, hashedPassword);
```

#### Rate Limiting
- 5 failed login attempts per 15 minutes per IP
- Account lockout after 10 failed attempts
- Use Upstash Redis or Vercel Rate Limiting

#### Account Lockout Logic
```typescript
// Check if account is locked
if (user.lockedUntil && user.lockedUntil > new Date()) {
  throw new Error("Account locked. Try again later.");
}

// Increment failed attempts
if (!isValidPassword) {
  await db.update(users)
    .set({
      failedAttempts: user.failedAttempts + 1,
      lockedUntil: user.failedAttempts >= 9
        ? new Date(Date.now() + 30 * 60 * 1000) // 30 min lock
        : null
    })
    .where(eq(users.id, user.id));
}

// Reset on successful login
await db.update(users)
  .set({ failedAttempts: 0, lockedUntil: null })
  .where(eq(users.id, user.id));
```

### Frontend Components

**Files to Create:**
- `src/components/auth/SignUpForm.tsx`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/PasswordInput.tsx`
- `src/components/auth/PasswordStrengthMeter.tsx`

---

## Phase 2: Email Verification & Password Reset (Week 2)

### Email Service Setup

**Recommended: Resend** (3,000 emails/month free)

```bash
npm install resend
```

**.env.local:**
```bash
RESEND_API_KEY=re_...
```

### Email Templates

#### Verification Email Template (`src/lib/email/templates.ts`)

```typescript
export const verificationEmailTemplate = (
  name: string,
  verificationUrl: string
) => `
<!DOCTYPE html>
<html>
<body>
  <h2>Welcome to Culinary AI Chef, ${name}!</h2>
  <p>Please verify your email address by clicking the link below:</p>
  <a href="${verificationUrl}">Verify Email</a>
  <p>This link expires in 24 hours.</p>
</body>
</html>
`;
```

### Password Reset Flow

**API Routes:**
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Submit new password
- `GET /api/auth/verify-reset-token` - Validate token

**Implementation:**
1. Generate secure token: `crypto.randomBytes(32).toString('hex')`
2. Store in `verificationTokens` table with 30-min expiry
3. Send email with reset link
4. Verify token and update password
5. Invalidate token after use

---

## Phase 3: Facebook OAuth (Week 2-3)

### Why Facebook for Food Apps?

**Perfect Demographic Match:**
- Largest user base in 25-55 age range (prime cooking demographic)
- Massive food & cooking community presence
- Recipe sharing culture
- Mobile-heavy usage
- Photo sharing capabilities

### Setup Steps

1. **Create Facebook Developer App**
   - Go to https://developers.facebook.com/
   - Create new app → "Consumer" type
   - Add "Facebook Login" product

2. **Configure OAuth Settings**
   - Valid OAuth Redirect URIs:
     - `http://localhost:3000/api/auth/callback/facebook`
     - `https://yourdomain.com/api/auth/callback/facebook`
   - App Domains: `localhost`, `yourdomain.com`

3. **Get Credentials**
   - App ID → `FACEBOOK_CLIENT_ID`
   - App Secret → `FACEBOOK_CLIENT_SECRET`

### Implementation

**Update `src/lib/auth.ts`:**

```typescript
import FacebookProvider from "next-auth/providers/facebook"

providers: [
  GoogleProvider({ /* existing */ }),
  FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    profile(profile) {
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.picture.data.url,
        firstName: profile.first_name,
        lastName: profile.last_name,
      }
    }
  }),
]
```

**Environment Variables:**
```bash
FACEBOOK_CLIENT_ID=your-app-id
FACEBOOK_CLIENT_SECRET=your-app-secret
```

### Account Linking

Handle case where user signs up with email, then tries Facebook with same email:

```typescript
// In NextAuth callbacks
async signIn({ user, account, profile }) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, user.email)
  });

  if (existingUser && account.provider !== "credentials") {
    // Link accounts
    await db.insert(accounts).values({
      userId: existingUser.id,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      // ... other fields
    });
    return true;
  }

  return true;
}
```

---

## Phase 4: Apple Sign-In (Week 3-4)

### Why Apple Sign-In?

**Benefits:**
- **Required** for iOS apps
- Premium user demographic
- High engagement rates
- Privacy-focused (appeals to security-conscious users)
- Clean, trusted UX

### Prerequisites

1. **Apple Developer Account** ($99/year)
   - Enroll at https://developer.apple.com/

2. **Configure Service ID**
   - Create App ID
   - Create Service ID
   - Enable "Sign in with Apple"
   - Configure domains and redirect URLs

3. **Generate Private Key**
   - Download `.p8` key file
   - Note the Key ID
   - Note the Team ID

### Implementation

**Update `src/lib/auth.ts`:**

```typescript
import AppleProvider from "next-auth/providers/apple"

providers: [
  // ... other providers
  AppleProvider({
    clientId: process.env.APPLE_ID!,
    clientSecret: process.env.APPLE_SECRET!,
  }),
]
```

**Environment Variables:**
```bash
APPLE_ID=com.yourapp.service
APPLE_SECRET=-----BEGIN PRIVATE KEY-----
...key content...
-----END PRIVATE KEY-----
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
```

### Apple Email Relay

Apple can hide user's real email with a relay email:
- Accept relay emails: `user@privaterelay.appleid.com`
- Handle in user profile
- Request real email if needed (optional in settings)

---

## Phase 5: GitHub OAuth (Optional)

### When to Add GitHub

**Consider if:**
- Targeting food bloggers who also code
- Building developer tools/API features
- Want early adopter tech-savvy users

**Skip if:**
- Focusing purely on cooking audience
- Want mainstream users only

### Implementation

```typescript
import GitHubProvider from "next-auth/providers/github"

providers: [
  // ... other providers
  GitHubProvider({
    clientId: process.env.GITHUB_ID!,
    clientSecret: process.env.GITHUB_SECRET!,
  }),
]
```

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── [...nextauth]/route.ts (existing)
│   │       ├── signup/route.ts
│   │       ├── forgot-password/route.ts
│   │       ├── reset-password/route.ts
│   │       └── verify-email/route.ts
│   ├── (auth)/
│   │   ├── sign-up/page.tsx
│   │   ├── sign-in/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── verify-email/page.tsx
│
├── components/
│   └── auth/
│       ├── SignUpForm.tsx
│       ├── SignInForm.tsx
│       ├── ForgotPasswordForm.tsx
│       ├── ResetPasswordForm.tsx
│       ├── OAuthButtons.tsx
│       ├── PasswordInput.tsx
│       └── PasswordStrengthMeter.tsx
│
├── lib/
│   ├── auth.ts (update with new providers)
│   ├── schema.ts (update with password field)
│   ├── validations/
│   │   └── auth.ts
│   ├── email/
│   │   ├── templates.ts
│   │   └── sender.ts
│   └── security/
│       ├── password.ts
│       ├── tokens.ts
│       └── rate-limit.ts
```

---

## Environment Variables Summary

### Required for Email/Password
```bash
# No additional vars needed (uses existing DATABASE_URL)
```

### Required for Email Service
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Required for Facebook OAuth
```bash
FACEBOOK_CLIENT_ID=xxxxxxxxxxxxx
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxx
```

### Required for Apple Sign-In
```bash
APPLE_ID=com.yourapp.service
APPLE_SECRET=-----BEGIN PRIVATE KEY-----...
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
```

### Optional for GitHub OAuth
```bash
GITHUB_ID=xxxxxxxxxxxxx
GITHUB_SECRET=xxxxxxxxxxxxx
```

### Optional Security Settings
```bash
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
PASSWORD_RESET_TOKEN_EXPIRY=1800000  # 30 minutes
EMAIL_VERIFICATION_TOKEN_EXPIRY=86400000  # 24 hours
```

---

## Implementation Timeline

### Week 1: Email/Password Foundation
- **Days 1-2:** Database schema + migrations
- **Days 3-4:** Backend API routes + validation
- **Days 5-7:** Frontend forms + testing

### Week 2: Email & Verification
- **Days 1-3:** Email service setup (Resend)
- **Days 4-5:** Verification flow
- **Days 6-7:** Password reset flow

### Week 3: Social OAuth
- **Days 1-2:** Facebook OAuth setup
- **Days 3-4:** Facebook implementation + testing
- **Days 5-7:** UI integration + account linking

### Week 4: Apple Sign-In (Optional)
- **Days 1-3:** Apple Developer setup
- **Days 4-6:** Implementation + testing
- **Day 7:** Polish + bug fixes

**Total Time:** 3-4 weeks for full implementation

---

## Security Considerations

### Password Security
- ✅ bcrypt with 12 rounds
- ✅ Minimum 8 characters, mixed requirements
- ✅ Never log passwords
- ✅ Reject common passwords

### Token Security
- ✅ Crypto-secure random generation (`crypto.randomBytes`)
- ✅ Short expiration (15-30 min for resets, 24h for verification)
- ✅ Single-use tokens (delete after use)
- ✅ Bind to user IP (optional)

### Rate Limiting
- ✅ 5 login attempts per 15 minutes
- ✅ 3 signup attempts per hour
- ✅ 2 email sends per 5 minutes
- ✅ Account lockout after 10 failed attempts

### Session Security
- ✅ Database sessions (not JWT)
- ✅ 30-day max age
- ✅ HttpOnly, Secure, SameSite cookies
- ✅ CSRF protection (NextAuth handles)

### SQL Injection Prevention
- ✅ Drizzle ORM parameterizes queries
- ✅ Never concatenate SQL strings
- ✅ Use prepared statements

### XSS Prevention
- ✅ React's built-in protection
- ✅ Sanitize user inputs
- ✅ Validate all form data with Zod

---

## Testing Checklist

### Email/Password Auth
- [ ] Sign up with valid credentials
- [ ] Sign up with existing email (should fail)
- [ ] Sign up with weak password (should fail)
- [ ] Sign in with correct credentials
- [ ] Sign in with wrong password (should fail)
- [ ] Account lockout after 10 failed attempts
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Token expiration handling

### Facebook OAuth
- [ ] Sign in with Facebook
- [ ] Sign up with Facebook
- [ ] Account linking (email + Facebook)
- [ ] Profile data mapping
- [ ] Handle Facebook errors

### Apple Sign-In
- [ ] Sign in with Apple (web)
- [ ] Sign in with Apple (iOS)
- [ ] Handle private email relay
- [ ] Profile data mapping
- [ ] Handle Apple errors

### Security
- [ ] Rate limiting triggers correctly
- [ ] Account lockout works
- [ ] Tokens expire properly
- [ ] Passwords are hashed
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] CSRF protection works

---

## Cost Analysis

### Free Tier Services
- ✅ NextAuth v5: Free
- ✅ Resend: 3,000 emails/month free
- ✅ Vercel: Free hosting
- ✅ Neon: Free PostgreSQL tier
- ✅ Google OAuth: Free
- ✅ Facebook OAuth: Free
- ✅ GitHub OAuth: Free

### Paid Services
- ⚠️ Apple Developer Program: **$99/year** (required for Apple Sign-In)
- ⚠️ Resend Pro: $20/month for 50,000 emails (when scaling)
- ⚠️ Upstash Redis: $10/month for rate limiting (optional)
- ⚠️ Vercel Pro: $20/month for better performance (optional)

**Minimum Cost to Start:** $0 (excluding Apple Sign-In)
**With Apple Sign-In:** $99/year

---

## Recommended Implementation Order

### MVP (2-3 weeks)
1. ✅ Email/Password authentication
2. ✅ Email verification
3. ✅ Password reset
4. ✅ Facebook OAuth

**Why this order:**
- Email/Password is baseline expectation
- Facebook gives biggest user boost for food apps
- Can launch without Apple initially

### Enhancement (1-2 weeks later)
5. ✅ Apple Sign-In (when iOS app planned)

### Optional (Future)
6. ⚠️ GitHub OAuth (only if developer features added)
7. ⚠️ Two-Factor Authentication (2FA)
8. ⚠️ Magic links (passwordless)

---

## Success Metrics

Track these after implementation:

### Auth Metrics
- Sign-up conversion rate by method
- Sign-in success rate
- Password reset requests per day
- Email verification completion rate
- OAuth provider usage distribution
- Failed login attempts
- Account lockouts

### User Experience
- Time to complete sign-up
- Form abandonment rate
- Auth error rates
- Support tickets related to auth

---

## Additional Resources

### Documentation
- [NextAuth v5 Docs](https://authjs.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Resend Docs](https://resend.com/docs)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Apple Sign-In](https://developer.apple.com/sign-in-with-apple/)
- [OWASP Auth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Tools
- [Password Strength Tester](https://github.com/dropbox/zxcvbn)
- [Email Template Builder](https://react.email/)
- [Rate Limiting with Upstash](https://upstash.com/docs/redis/features/ratelimiting)

---

## Notes

- This plan was created based on current NextAuth v5 (beta.30)
- Adjust timelines based on team size and experience
- Test thoroughly in development before production
- Consider A/B testing different auth flows
- Monitor auth metrics to optimize conversion
- Keep security patches up to date

---

**Last Updated:** 2025-11-04
**Status:** Planning Phase
**Next Step:** Begin Phase 1 (Email/Password) when ready
