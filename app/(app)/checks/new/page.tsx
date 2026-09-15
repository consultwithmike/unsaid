import { CheckNewClient } from "./CheckNewClient";

export const metadata = { title: "Check Unsaid together" };

export default function NewCheckPage() {
  return (
    <div className="container-content py-12">
      <CheckNewClient />
    </div>
  );
}
