import { systemStorageConfigured } from "@/lib/systemGoogle";

export function getAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME || "LeadFlow";
}

export function configurationStatus() {
  return {
    portalConfigured: Boolean(
      process.env.ADMIN_USERNAME?.trim() &&
        process.env.ADMIN_PASSWORD &&
        process.env.AUTH_SECRET
    ),
    systemStorageConfigured: systemStorageConfigured(),
  };
}
