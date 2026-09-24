import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import UsersAdminClient from "./UsersAdminClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>User Accounts</h1>
        <p>
          Create and manage LeadFlow accounts without sharing the master
          Vercel administrator password.
        </p>
      </section>

      <UsersAdminClient
        currentUsername={session.username}
        currentSource={session.source}
        masterUsername={process.env.ADMIN_USERNAME?.trim() || "Master admin"}
      />
    </div>
  );
}
