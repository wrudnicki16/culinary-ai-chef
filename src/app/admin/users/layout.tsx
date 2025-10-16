import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Management - CulinaryAI Chef Admin",
  description: "Manage user accounts, permissions, and roles in CulinaryAI Chef. View all users, promote to admin, and handle user-related administration tasks.",
};

export default function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
