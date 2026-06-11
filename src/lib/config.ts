// Firm configuration, driven by environment variables so the platform is firm-agnostic.

export type Attorney = { name: string; practiceAreas: string[] };

function parseAttorneys(raw: string | undefined): Attorney[] {
  // Format: "Name:area|area,Name2:area"
  if (!raw) {
    return [
      { name: "Rachel Hartwell", practiceAreas: ["personal injury", "employment law"] },
      { name: "Marcus Vance", practiceAreas: ["business law"] },
      { name: "Priya Natarajan", practiceAreas: ["family law", "estate planning"] }
    ];
  }
  return raw.split(",").map((entry) => {
    const [name, areas] = entry.split(":");
    return { name: name.trim(), practiceAreas: (areas || "").split("|").map((a) => a.trim()).filter(Boolean) };
  });
}

export const firmConfig = {
  name: process.env.FIRM_NAME || "Hartwell & Vance LLP",
  practiceAreas: (process.env.FIRM_PRACTICE_AREAS || "personal injury,family law,estate planning,business law")
    .split(",")
    .map((a) => a.trim()),
  attorneys: parseAttorneys(process.env.FIRM_ATTORNEYS)
};

export const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
