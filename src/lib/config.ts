// Firm configuration, driven by environment variables so the platform is firm-agnostic.

export type Attorney = { name: string; practiceAreas: string[] };

function parseAttorneys(raw: string | undefined): Attorney[] {
  // Format: "Name:area|area,Name2:area"
  if (!raw) {
    return [
      { name: "Rachel Hartwell", practiceAreas: ["personal injury", "employment law"] },
      { name: "Marcus Vance", practiceAreas: ["business law"] },
      { name: "Priya Natarajan", practiceAreas: ["family law", "estate planning"] },
      { name: "Elena Cruz", practiceAreas: ["immigration law"] }
    ];
  }
  return raw.split(",").map((entry) => {
    const [name, areas] = entry.split(":");
    return { name: name.trim(), practiceAreas: (areas || "").split("|").map((a) => a.trim()).filter(Boolean) };
  });
}

export const firmConfig = {
  name: process.env.FIRM_NAME || "Hartwell & Vance LLP",
  practiceAreas: (process.env.FIRM_PRACTICE_AREAS || "personal injury,family law,estate planning,business law,immigration law")
    .split(",")
    .map((a) => a.trim()),
  attorneys: parseAttorneys(process.env.FIRM_ATTORNEYS)
};

// Attorney-of-record profile used when preparing USCIS forms (Form G-28 Part 1-2).
// In production each attorney would have their own profile row; env-overridable.
export const attorneyProfile = {
  familyName: process.env.ATTY_FAMILY_NAME || "Cruz",
  givenName: process.env.ATTY_GIVEN_NAME || "Elena",
  middleName: process.env.ATTY_MIDDLE_NAME || "",
  street: process.env.ATTY_STREET || "1200 Liberty Avenue, Suite 410",
  city: process.env.ATTY_CITY || "New York",
  state: process.env.ATTY_STATE || "NY",
  zip: process.env.ATTY_ZIP || "10005",
  phone: process.env.ATTY_PHONE || "(212) 555-0142",
  email: process.env.ATTY_EMAIL || "ecruz@hartwellvance.com",
  licensingAuthority: process.env.ATTY_LICENSING_AUTHORITY || "New York State Bar",
  barNumber: process.env.ATTY_BAR_NUMBER || "5550123",
  lawFirm: process.env.FIRM_NAME || "Hartwell & Vance LLP"
};

export const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
