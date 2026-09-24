import SetupClient from "./SetupClient";
import { configurationStatus } from "@/lib/config";

export default function SetupPage() {
  const status = configurationStatus();

  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>Setup</h1>
        <p>
          Verify your Apify and Google Sheets connection. Secrets are stored in
          Vercel environment variables, not in the browser.
        </p>
      </section>
      <SetupClient initial={status} />
    </div>
  );
}
