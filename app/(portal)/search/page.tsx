import SearchClient from "./SearchClient";

export default function SearchPage() {
  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>Search Leads</h1>
        <p>
          Choose a business type and area, then send unique results directly to
          your Google Sheet.
        </p>
      </section>
      <SearchClient />
    </div>
  );
}
