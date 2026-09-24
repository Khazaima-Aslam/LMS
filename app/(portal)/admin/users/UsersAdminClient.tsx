"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ManagedUser = {
  username: string;
  displayName: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  users?: ManagedUser[];
  user?: ManagedUser;
};

async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "PUT",
  body?: Record<string, unknown>
) {
  const response = await fetch("/api/admin/users", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const data = (contentType.includes("application/json")
    ? await response.json()
    : { ok: false, error: await response.text() }) as ApiResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export default function UsersAdminClient({
  currentUsername,
  currentSource,
  masterUsername,
}: {
  currentUsername: string;
  currentSource: "master" | "managed";
  masterUsername: string;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>(
    {}
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("GET");
      setUsers(data.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking("create");
    setMessage("");
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      await apiRequest("POST", {
        username: form.get("username"),
        displayName: form.get("displayName"),
        role: form.get("role"),
        password: form.get("password"),
      });
      e.currentTarget.reset();
      setMessage("Account created successfully.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create account.");
    } finally {
      setWorking("");
    }
  }

  async function updateUser(
    username: string,
    changes: Partial<Pick<ManagedUser, "active" | "role" | "displayName">>
  ) {
    setWorking(`update:${username}`);
    setMessage("");
    setError("");

    try {
      await apiRequest("PATCH", { username, ...changes });
      setMessage(`Updated ${username}.`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update account.");
    } finally {
      setWorking("");
    }
  }

  async function resetPassword(username: string) {
    const password = resetPasswords[username] || "";
    setWorking(`password:${username}`);
    setMessage("");
    setError("");

    try {
      await apiRequest("PUT", { username, password });
      setResetPasswords((current) => ({ ...current, [username]: "" }));
      setMessage(`Password reset for ${username}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reset password.");
    } finally {
      setWorking("");
    }
  }

  return (
    <>
      <section className="panel masterAdminCard">
        <div>
          <span className="eyebrow">MASTER ADMINISTRATOR</span>
          <h2>{masterUsername}</h2>
          <p className="muted">
            This account is controlled by Vercel environment variables and
            cannot be disabled from this page.
          </p>
        </div>
        <span className="adminPill">Admin</span>
      </section>

      <section className="panel">
        <h2>Create account</h2>
        <p className="muted">
          Give each person their own login instead of sharing the master
          administrator password.
        </p>

        <form className="adminCreateGrid" onSubmit={createUser}>
          <label>
            Username
            <input
              name="username"
              placeholder="e.g. sales.user"
              minLength={3}
              maxLength={50}
              required
            />
          </label>
          <label>
            Display name
            <input
              name="displayName"
              placeholder="e.g. Sales User"
              maxLength={100}
            />
          </label>
          <label>
            Role
            <select name="role" defaultValue="user">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Temporary password
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primaryBtn adminCreateBtn" disabled={working === "create"}>
            {working === "create" ? "Creating..." : "Create account"}
          </button>
        </form>

        {message ? <div className="testMessage">{message}</div> : null}
        {error ? <div className="errorBox">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="adminTableHeader">
          <div>
            <h2>Managed accounts</h2>
            <p className="muted">
              Password hashes are stored in the hidden _LeadFlowUsers Google
              Sheet tab. Plain passwords are never stored.
            </p>
          </div>
          <button
            className="secondaryBtn"
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="adminEmpty">Loading accounts...</div>
        ) : users.length === 0 ? (
          <div className="adminEmpty">
            No managed accounts yet. Create the first account above.
          </div>
        ) : (
          <div className="userTableWrap">
            <table className="userTable">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Reset password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const selfManaged =
                    currentSource === "managed" &&
                    currentUsername.toLowerCase() === user.username.toLowerCase();
                  const busy =
                    working === `update:${user.username}` ||
                    working === `password:${user.username}`;

                  return (
                    <tr key={user.username}>
                      <td>
                        <strong>{user.displayName || user.username}</strong>
                        <span className="userMeta">@{user.username}</span>
                      </td>
                      <td>
                        <select
                          value={user.role}
                          disabled={busy || selfManaged}
                          onChange={(e) =>
                            void updateUser(user.username, {
                              role: e.target.value as ManagedUser["role"],
                            })
                          }
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={user.active ? "statusPill active" : "statusPill inactive"}>
                          {user.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        <div className="resetPasswordCell">
                          <input
                            type="password"
                            minLength={8}
                            placeholder="New password"
                            autoComplete="new-password"
                            value={resetPasswords[user.username] || ""}
                            onChange={(e) =>
                              setResetPasswords((current) => ({
                                ...current,
                                [user.username]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="secondaryBtn"
                            disabled={
                              busy ||
                              (resetPasswords[user.username] || "").length < 8
                            }
                            onClick={() => void resetPassword(user.username)}
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={user.active ? "dangerBtn" : "secondaryBtn"}
                          disabled={busy || selfManaged}
                          onClick={() =>
                            void updateUser(user.username, {
                              active: !user.active,
                            })
                          }
                        >
                          {user.active ? "Disable" : "Enable"}
                        </button>
                        {selfManaged ? (
                          <span className="userMeta">Current account</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
