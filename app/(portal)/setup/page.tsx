import ConnectionsClient from "./SetupClient";

export default function SetupPage() {
  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>My Connections</h1>
        <p>
          Connect your own Apify account and your own Google Sheet. These
          settings belong only to your LeadFlow account.
        </p>
      </section>
      <ConnectionsClient />
    </div>
  );
}
