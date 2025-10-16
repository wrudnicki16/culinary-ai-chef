import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Your Recipe Collection",
  description: "View your saved recipes, generated recipes, and manage your culinary profile. Track your favorite AI-generated dishes and cooking preferences.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
