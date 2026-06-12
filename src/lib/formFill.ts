// Fills the real USCIS Form G-28 (Notice of Entry of Appearance as Attorney).
// The template in /public/forms/g-28-template.pdf is the official USCIS PDF with
// its XFA layer stripped (one-time preprocessing) so the AcroForm fields are
// programmatically fillable. Field names below are the form's own field names.
import { PDFDocument } from "pdf-lib";
import { attorneyProfile } from "./config";

const P1 = "form1[0].#subform[0]";
const P2 = "form1[0].#subform[1]";
const P3 = "form1[0].#subform[2]";

export type G28ClientData = {
  clientFamilyName: string;
  clientGivenName: string;
  clientMiddleName?: string;
  clientPhone?: string;
  clientMobile?: string;
  clientEmail?: string;
  clientStreet?: string;
  clientApt?: string;
  clientCity?: string;
  clientState?: string; // 2-letter
  clientZip?: string;
  /** 'applicant' | 'petitioner' | 'requestor' | 'beneficiary' */
  clientRole: string;
  /** e.g. "I-130, Petition for Alien Relative" — the matter this appearance covers */
  matterDescription: string;
  uscisAccountNumber?: string;
  receiptNumber?: string;
};

export async function fillG28(templateBytes: Uint8Array, data: G28ClientData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  const setText = (name: string, value: string | undefined | null) => {
    if (!value) return;
    try {
      form.getTextField(name).setText(String(value).slice(0, 80));
    } catch {
      /* field name mismatch — skip rather than fail the whole document */
    }
  };
  const check = (name: string) => {
    try {
      form.getCheckBox(name).check();
    } catch { /* ignore */ }
  };
  const setDropdown = (name: string, value: string | undefined) => {
    if (!value) return;
    try {
      form.getDropdown(name).select(value);
    } catch { /* state code not in options — ignore */ }
  };

  /* ---- Part 1: attorney (page 1) ---- */
  setText(`${P1}.Line2a_FamilyName[0]`, attorneyProfile.familyName);
  setText(`${P1}.Line2b_GivenName[0]`, attorneyProfile.givenName);
  setText(`${P1}.Line2c_MiddleName[0]`, attorneyProfile.middleName);
  setText(`${P1}.Line3a_StreetNumber[0]`, attorneyProfile.street);
  setText(`${P1}.Line3c_CityOrTown[0]`, attorneyProfile.city);
  setDropdown(`${P1}.Line3d_State[0]`, attorneyProfile.state);
  setText(`${P1}.Line3e_ZipCode[0]`, attorneyProfile.zip);
  setText(`${P1}.Line4_DaytimeTelephoneNumber[0]`, attorneyProfile.phone);
  setText(`${P1}.Line6_EMail[0]`, attorneyProfile.email);

  /* ---- Part 2: attorney eligibility (page 2) ---- */
  check(`${P2}.Checkbox1dAmNot[0]`); // not subject to discipline
  setText(`${P2}.Line1a_LicensingAuthority[0]`, attorneyProfile.licensingAuthority);
  setText(`${P2}.Line1b_BarNumber[0]`, attorneyProfile.barNumber);
  setText(`${P2}.Line1c_NameofLawFirm[0]`, attorneyProfile.lawFirm);

  /* ---- Part 3: appearance + client ---- */
  check(`${P1}.Line1a_USCIS[0]`); // appearance before USCIS
  setText(`${P1}.Line1b_ListFormNumber[0]`, data.matterDescription);

  const role = (data.clientRole || "applicant").toLowerCase();
  const roleIndex = role.includes("petition") ? 1 : role.includes("request") ? 2 : role.includes("benefic") ? 3 : 0;
  check(`${P1}.Line4_Checkbox[${roleIndex}]`);

  setText(`${P1}.Line5a_FamilyName[0]`, data.clientFamilyName);
  setText(`${P1}.Line5b_GivenName[0]`, data.clientGivenName);
  setText(`${P1}.Line5c_MiddleName[0]`, data.clientMiddleName);
  setText(`${P1}.#area[0].P1_L1_ELISAcctNumber[0]`, data.uscisAccountNumber);

  setText(`${P2}.Line8_ReceiptNumber[0]`, data.receiptNumber);
  setText(`${P2}.Line9_DaytimeTelephoneNumber[0]`, data.clientPhone);
  setText(`${P2}.Line10_MobileTelephoneNumber[0]`, data.clientMobile);
  setText(`${P2}.Line11_EMail[0]`, data.clientEmail);
  setText(`${P2}.Line12a_StreetNumberName[0]`, data.clientStreet);
  setText(`${P2}.Line12b_AptSteFlrNumber[0]`, data.clientApt);
  setText(`${P2}.Line12c_CityOrTown[0]`, data.clientCity);
  setDropdown(`${P2}.Line12d_State[0]`, data.clientState);
  setText(`${P2}.Line12e_ZipCode[0]`, data.clientZip);

  /* ---- Part 4/5: names + date (signatures stay blank for wet/e-sign) ---- */
  setText(`${P3}.Line3_NameofAttorneyOrRep[0]`, `${attorneyProfile.givenName} ${attorneyProfile.familyName}`);
  setText(`${P3}.Line3_Date[0]`, new Date().toLocaleDateString("en-US"));

  return doc.save();
}
