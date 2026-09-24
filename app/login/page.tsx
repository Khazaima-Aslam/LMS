import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const configured = Boolean(
    process.env.ADMIN_USERNAME?.trim() &&
      process.env.ADMIN_PASSWORD &&
      process.env.AUTH_SECRET
  );

  return (
    <main className="loginPage">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="brandMark large">L</div>
          <div>
            <h1>LeadFlow</h1>
            <p>Private business lead workspace</p>
          </div>
        </div>

        {!configured ? (
          <div className="errorBox loginConfigWarning">
            <b>Vercel setup required.</b>
            <div>
              Add <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code> and{" "}
              <code>AUTH_SECRET</code> under Vercel → Project → Settings →
              Environment Variables, then redeploy.
            </div>
          </div>
        ) : null}

        <LoginForm configured={configured} />
        <p className="loginHint">
          API credentials and login secrets stay on the server as Vercel environment variables.
        </p>
      </div>
    </main>
  );
}
