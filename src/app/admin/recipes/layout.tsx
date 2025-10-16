import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recipe Management - CulinaryAI Chef Admin",
  description: "Manage all recipes in the CulinaryAI Chef platform. View, edit, delete, and verify user-submitted and AI-generated recipes.",
};

export default function AdminRecipesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
