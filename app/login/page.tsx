import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

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
        <LoginForm />
        <p className="loginHint">
          Your API credentials stay on the server as Vercel environment variables.
        </p>
      </div>
    </main>
  );
}
