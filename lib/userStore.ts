import { systemSheetsContext } from "@/lib/systemGoogle";
import {
  MANAGED_USER_HEADERS,
  normalizeManagedRole,
  privateUserFromRow,
  publicUserFromPrivate,
  userToRow,
  type ManagedRole,
  type ManagedUserPrivate,
  type ManagedUserPublic,
} from "@/lib/managedUsers";
import {
  hashManagedPassword,
  normalizeManagedUsername,
  verifyManagedPassword,
} from "@/lib/userSecurity";

const USER_TAB = "_LeadFlowUsers";

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function validateDisplayName(value: string, username: string) {
  const displayName = String(value || "").trim() || username;
  if (displayName.length > 100) {
    throw new Error("Display name must be 100 characters or fewer.");
  }
  return displayName;
}

async function ensureManagedUserSheet() {
  const { sheets, spreadsheetId } = await systemSheetsContext();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const exists = (meta.data.sheets || []).some(
    (sheet) => sheet.properties?.title === USER_TAB
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: USER_TAB,
                hidden: true,
              },
            },
          },
        ],
      },
    });
  }

  const headerRange = `${quoteSheetName(USER_TAB)}!A1:H1`;
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });
  const current = header.data.values?.[0] || [];
  const required = [...MANAGED_USER_HEADERS];

  if (!required.every((value, index) => current[index] === value)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "RAW",
      requestBody: { values: [required] },
    });
  }

  return { sheets, spreadsheetId };
}

async function readPrivateUsers() {
  const { sheets, spreadsheetId } = await ensureManagedUserSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(USER_TAB)}!A2:H`,
  });

  const users: Array<{ rowNumber: number; user: ManagedUserPrivate }> = [];

  for (const [index, rawRow] of (response.data.values || []).entries()) {
    if (!String(rawRow?.[0] || "").trim()) continue;
    try {
      users.push({
        rowNumber: index + 2,
        user: privateUserFromRow(rawRow),
      });
    } catch (error) {
      console.error("Skipping invalid managed user row", index + 2, error);
    }
  }

  return { sheets, spreadsheetId, users };
}

async function findPrivateUser(usernameValue: string) {
  const username = normalizeManagedUsername(usernameValue);
  const context = await readPrivateUsers();
  const found = context.users.find(
    (entry) => entry.user.username.toLowerCase() === username
  );
  return { ...context, username, found };
}

export async function listManagedUsers(): Promise<ManagedUserPublic[]> {
  const { users } = await readPrivateUsers();
  return users
    .map((entry) => publicUserFromPrivate(entry.user))
    .sort((a, b) => a.username.localeCompare(b.username));
}

export async function createManagedUser(args: {
  username: string;
  displayName?: string;
  role: ManagedRole | string;
  password: string;
}) {
  const username = normalizeManagedUsername(args.username);
  const role = normalizeManagedRole(String(args.role || "user"));
  const displayName = validateDisplayName(args.displayName || "", username);
  const { salt, hash } = hashManagedPassword(args.password);

  const masterUsername = String(process.env.ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();

  if (masterUsername && username === masterUsername) {
    throw new Error("This username is reserved for the master administrator.");
  }

  const context = await readPrivateUsers();
  const duplicate = context.users.some(
    (entry) => entry.user.username.toLowerCase() === username
  );
  if (duplicate) {
    throw new Error("A user with this username already exists.");
  }

  const now = new Date().toISOString();
  const user: ManagedUserPrivate = {
    username,
    displayName,
    role,
    passwordSalt: salt,
    passwordHash: hash,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await context.sheets.spreadsheets.values.append({
    spreadsheetId: context.spreadsheetId,
    range: `${quoteSheetName(USER_TAB)}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [userToRow(user)] },
  });

  return publicUserFromPrivate(user);
}

export async function updateManagedUser(
  usernameValue: string,
  changes: {
    displayName?: string;
    role?: ManagedRole | string;
    active?: boolean;
  }
) {
  const context = await findPrivateUser(usernameValue);
  if (!context.found) throw new Error("Managed user not found.");

  const next: ManagedUserPrivate = {
    ...context.found.user,
    displayName:
      changes.displayName === undefined
        ? context.found.user.displayName
        : validateDisplayName(changes.displayName, context.username),
    role:
      changes.role === undefined
        ? context.found.user.role
        : normalizeManagedRole(String(changes.role)),
    active:
      changes.active === undefined
        ? context.found.user.active
        : Boolean(changes.active),
    updatedAt: new Date().toISOString(),
  };

  await context.sheets.spreadsheets.values.update({
    spreadsheetId: context.spreadsheetId,
    range: `${quoteSheetName(USER_TAB)}!A${context.found.rowNumber}:H${context.found.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [userToRow(next)] },
  });

  return publicUserFromPrivate(next);
}

export async function resetManagedUserPassword(
  usernameValue: string,
  password: string
) {
  const context = await findPrivateUser(usernameValue);
  if (!context.found) throw new Error("Managed user not found.");

  const { salt, hash } = hashManagedPassword(password);
  const next: ManagedUserPrivate = {
    ...context.found.user,
    passwordSalt: salt,
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  };

  await context.sheets.spreadsheets.values.update({
    spreadsheetId: context.spreadsheetId,
    range: `${quoteSheetName(USER_TAB)}!A${context.found.rowNumber}:H${context.found.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [userToRow(next)] },
  });

  return publicUserFromPrivate(next);
}

export async function authenticateManagedUser(
  usernameValue: string,
  password: string
) {
  let username: string;
  try {
    username = normalizeManagedUsername(usernameValue);
  } catch {
    return null;
  }

  const context = await readPrivateUsers();
  const found = context.users.find(
    (entry) => entry.user.username.toLowerCase() === username
  );

  if (!found?.user.active) return null;

  const user = found.user;
  const valid = verifyManagedPassword(
    password,
    user.passwordSalt,
    user.passwordHash
  );

  return valid ? publicUserFromPrivate(user) : null;
}
