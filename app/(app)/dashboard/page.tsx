import { DashboardClient } from "./DashboardClient";

export const metadata = { title: "Your Unsaid — Dashboard" };

export default function DashboardPage() {
  return (
    <div className="container-content py-12">
      <DashboardClient />
    </div>
  );
}
