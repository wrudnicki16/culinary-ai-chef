import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import GoogleProvider from "next-auth/providers/google"
import { db } from "./db"
import { accounts, sessions, users, verificationTokens } from "./schema"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        roles: (user as { roles?: string[] }).roles || [],
        firstName: (user as { firstName?: string | null }).firstName,
        lastName: (user as { lastName?: string | null }).lastName,
        profileImageUrl: (user as { profileImageUrl?: string | null }).profileImageUrl,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) {
        token.roles = (user as { roles?: string[] }).roles || [];
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
})