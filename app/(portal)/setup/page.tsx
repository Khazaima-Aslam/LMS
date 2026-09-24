import SetupClient from "./SetupClient";
import { configurationStatus } from "@/lib/config";

export default function SetupPage() {
  const status = configurationStatus();

  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>System Status</h1>
        <p>
          Check whether LeadFlow is ready to extract leads and write results to
          Google Sheets.
        </p>
      </section>
      <SetupClient initial={status} />
    </div>
  );
}
