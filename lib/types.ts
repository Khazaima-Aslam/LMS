export type Lead = {
  businessName: string;
  category: string;
  fullAddress: string;
  city: string;
  country: string;
  mobile: string;
  landline: string;
  email: string;
  phone: string;
};

export const LEAD_HEADERS = [
  "Business Name",
  "Category",
  "Full Address",
  "City",
  "Country",
  "Mobile",
  "Landline",
  "Email",
  "Phone",
] as const;
