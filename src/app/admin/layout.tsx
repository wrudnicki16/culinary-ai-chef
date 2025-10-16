import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard - Manage CulinaryAI Chef",
  description: "Administrator dashboard to manage users, recipes, and application settings for CulinaryAI Chef. View platform statistics, manage content, and respond to user support.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
