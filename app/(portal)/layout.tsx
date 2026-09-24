import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { getAppName } from "@/lib/config";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="portal">
      <Sidebar role={session.role} />
      <div className="mainShell">
        <header className="topbar">
          <strong>{getAppName()}</strong>
          <span className="confidential">
            CONFIDENTIAL · BUSINESS USE ONLY
          </span>
          <div className="topbarRight">
            <span>
              Welcome, <b>{session.displayName || session.username}</b>
              <em className="roleBadge">{session.role}</em>
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="signoutBtn">Sign out</button>
            </form>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
