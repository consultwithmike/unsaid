import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings — Unsaid" };

export default function SettingsPage() {
  return (
    <div className="container-content py-12">
      <SettingsClient />
    </div>
  );
}
