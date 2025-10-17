import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      firstName?: string | null;
      lastName?: string | null;
      profileImageUrl?: string | null;
    } & DefaultSession["user"];
  }
}