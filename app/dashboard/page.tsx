import type { Metadata } from "next";
import { DashboardClient } from "@/components/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Configure your GitHub to Notion one-repo sync and monitor webhook health in real time."
};

export default function DashboardPage() {
  return <DashboardClient />;
}
