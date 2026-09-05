/**
 * Deterministic seed fixtures for Rejectionism CampaignOS.
 * Sources:
 *  - docs/sources/REJECTIONISM-WORLD-DOMINATION-HQ.md (dated 5 September 2026)
 *  - docs/sources/THE REJECTIONIST MANIFESTO.md
 */

export interface SeedCanonEntry {
  key: string;
  value: string;
  category: string;
  notes: string | null;
}

export interface SeedWebsite {
  name: string;
  domain: string;
  purpose: string;
  status: "PLANNED" | "RESERVED" | "IN_PROGRESS" | "LIVE" | "REDIRECT" | "UNKNOWN";
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  notes: string | null;
}

export interface SeedWorkItem {
  id: string;
  title: string;
  description: string;
  status: "BACKLOG" | "NEXT" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority: number;
}

export interface SeedAsset {
  id: string;
  name: string;
  kind: string;
  status: "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";
  sourceFilename: string | null;
  url: string | null;
  notes: string | null;
}

export const SEED_CANON_ENTRIES: SeedCanonEntry[] = [
  {
    key: "movement.name",
    value: "REJECTIONISM",
    category: "identity",
    notes: "Canonical English name (HQ Section 1)",
  },
  {
    key: "movement.slogan",
    value: "The art movement nobody applied for.",
    category: "identity",
    notes: "Main descriptor / movement slogan (HQ Section 1)",
  },
  {
    key: "movement.latin_slogan",
    value: "AD NIHILUM",
    category: "identity",
    notes: "Movement Latin motto (HQ Section 1)",
  },
  {
    key: "movement.italian_name",
    value: "RIFIUTAZIONISMO",
    category: "identity",
    notes: "Canonical Italian name (HQ Section 1)",
  },
  {
    key: "movement.secondary_slogan",
    value: "The revolution that was never shortlisted.",
    category: "identity",
    notes: "Secondary movement line (HQ Section 1)",
  },
  {
    key: "movement.campaign_slogan",
    value: "Rejected. Unqualified. Unstoppable.",
    category: "identity",
    notes: "Campaign line (HQ Section 1)",
  },
  {
    key: "movement.response_slogan",
    value:
      "Thank you for your consideration. Please keep our details on file for future opportunities.",
    category: "identity",
    notes: "Final canonical response line (HQ Section 1)",
  },
  {
    key: "founders.names",
    value: "Alfonso and Michele",
    category: "founders",
    notes: "Co-founders of the movement (HQ Section 1 & 2)",
  },
  {
    key: "founders.michele_title",
    value: "The Grand Architect of No",
    category: "founders",
    notes: "Michele's canonical title (HQ Section 1 & 2)",
  },
  {
    key: "papal.name",
    value: "Pope Rejectus IV",
    category: "papal",
    notes: "Papal name for Valeriano da Scalcagna, Vicar of the Unshortlisted (HQ Section 1 & 2)",
  },
  {
    key: "papal.style",
    value:
      "His Holiness Pope Rejectus IV, Supreme Pontiff of the Holy Rejection and Vicar of the Unshortlisted",
    category: "papal",
    notes: "Full papal style (HQ Section 1 & 2)",
  },
  {
    key: "papal.motto",
    value: "Applica et Reicere.",
    category: "papal",
    notes: "Papal motto (HQ Section 1 & 2)",
  },
  {
    key: "papal.sign_off",
    value: "E se lo dice Papa Rejectus...",
    category: "papal",
    notes: "Papal sign-off (HQ Section 1 & 2)",
  },
];

export const SEED_WEBSITES: SeedWebsite[] = [
  {
    name: "Rejectionism Movement HQ",
    domain: "rejectionism.co.uk",
    purpose:
      "Main public front door and canonical explanation of the movement. Minimum useful version: one-page launch site with hero, concise explanation, manifesto, founders, institutions, selected work, and links to Archive. Primary action: Read the manifesto / Submit your rejection (HQ Section 3).",
    status: "UNKNOWN",
    repositoryUrl: null,
    deploymentUrl: null,
    notes: "Role agreed; ownership, DNS, and deployment status to confirm (HQ Section 3 & 11).",
  },
  {
    name: "Archive of No",
    domain: "archiveofno.com",
    purpose:
      "Participatory heart of the movement: public archive of rejection stories and rejection artefacts with low-friction submission, optional anonymity/pseudonym, moderation, redaction, and permanent share pages (HQ Section 3 & 6).",
    status: "UNKNOWN",
    repositoryUrl: null,
    deploymentUrl: null,
    notes: "Role and low-friction principle agreed; build status to confirm (HQ Section 3 & 11).",
  },
  {
    name: "Ministry of Rejection",
    domain: "mor-gov.org",
    purpose:
      "Ministry of Rejection: official propaganda, decrees, forms, certificates, campaign posters, and eventually merchandise. Compact institutional satire site (HQ Section 3).",
    status: "UNKNOWN",
    repositoryUrl: null,
    deploymentUrl: null,
    notes: "Role agreed; build status to confirm; shop is future-only (HQ Section 3 & 11).",
  },
  {
    name: "Department of Rejection Domain Guard",
    domain: "dor-gov.co.uk",
    purpose:
      "Defensive and alternate Ministry domain. Minimum useful version: permanent redirect to mor-gov.org; no separate product (HQ Section 3).",
    status: "UNKNOWN",
    repositoryUrl: null,
    deploymentUrl: null,
    notes: "Defensive domain guard; redirect to mor-gov.org to confirm (HQ Section 3 & 11).",
  },
];

export const SEED_WORK_ITEMS: SeedWorkItem[] = [
  {
    id: "seed-work-01",
    title: "Record the final primary/secondary logo decision.",
    description:
      "Declare official logo and slogan.png the primary seal and offocial logo.png the narrative variant—or record a different final decision in the decisions log (HQ Phase 0 / Move 1).",
    status: "NEXT",
    priority: 100,
  },
  {
    id: "seed-work-02",
    title: "Recover the important missing visuals listed above.",
    description:
      "Find and recover original master files for Alfonso comic, Michele comic, Pope Rejectus IV portrait/arms/miracle icon, Church crest, Keep Calm shirt, and Facebook launch assets before recreating anything (HQ Phase 0 / Move 2).",
    status: "NEXT",
    priority: 90,
  },
  {
    id: "seed-work-03",
    title: "Create the proper vector and export pack.",
    description:
      "Commission vector redraw of primary seal and produce complete export pack (transparent PNGs at 4096/2048/1024/512, monochrome/color variants, favicons 32-180px) (HQ Phase 0 / Move 3).",
    status: "NEXT",
    priority: 80,
  },
  {
    id: "seed-work-04",
    title: "Confirm the four domains, redirects, renewal dates, and social URLs.",
    description:
      "Confirm registrar, renewal dates, DNS, analytics, email, and deployment for rejectionism.co.uk, archiveofno.com, mor-gov.org, and dor-gov.co.uk redirect; record Facebook URL (HQ Phase 0 / Move 4).",
    status: "NEXT",
    priority: 70,
  },
  {
    id: "seed-work-05",
    title: "Finish and publish the one-page rejectionism.co.uk front door.",
    description:
      "Launch strong single-page movement site with primary banner, concise explanation, founders, manifesto, visual highlights, and dominant Archive CTA (HQ Phase 1 / Move 5).",
    status: "NEXT",
    priority: 60,
  },
  {
    id: "seed-work-06",
    title: "Finalize Archive of No submission, moderation, redaction, and share-page rules.",
    description:
      "Establish non-negotiable submission rules: submission before registration, anonymous by default, human moderation, pre-publication redaction, permanent share URLs, and consent/takedown routes (HQ Phase 2 / Move 6).",
    status: "NEXT",
    priority: 50,
  },
  {
    id: "seed-work-07",
    title: "Seed the Archive with 25–40 strong entries.",
    description:
      "Publish 25-40 varied, approved rejection stories and artefacts from founders and trusted early contributors before public launch to ensure the archive is populated (HQ Phase 2 / Move 7).",
    status: "NEXT",
    priority: 40,
  },
  {
    id: "seed-work-08",
    title: "Publish the two launch posters and founder banner as a coordinated opening campaign.",
    description:
      "Launch opening campaign using poster A ('They said no. We built a movement.'), poster B ('The cult of success sold you a lie.'), and founders hero banner (HQ Phase 3 / Move 8).",
    status: "NEXT",
    priority: 30,
  },
  {
    id: "seed-work-09",
    title: "Begin the weekly three-format content rhythm: Archive story, Ministry decree, Church/Founder lore.",
    description:
      "Establish recurring weekly publishing schedule: Rejection of the Week (Archive story), Ministry Decree, and Pontifical Bull / Founder Lore (HQ Phase 3 / Move 9).",
    status: "NEXT",
    priority: 20,
  },
  {
    id: "seed-work-10",
    title: "Review actual submissions and sharing after four weeks before building shops, extra sites, apps, or elaborate features.",
    description:
      "Review scoreboard signals (submission completion, moderation turnaround, share rates, countries represented) after four weeks before expanding infrastructure (HQ Phase 3 / Move 10).",
    status: "NEXT",
    priority: 10,
  },
];

export const SEED_ASSETS: SeedAsset[] = [
  // ---------------------------------------------------------------------------
  // Section 4A — Current Attached Pack
  // ---------------------------------------------------------------------------
  {
    id: "seed-asset-4a-01",
    name: "Primary Movement Seal (official logo and slogan.png)",
    kind: "logo",
    status: "NEEDS_WORK",
    sourceFilename: "official logo and slogan.png",
    url: null,
    notes:
      "Best complete emblem in current pack: raised fist, inverted rays, defeated figure, and AD NIHILUM motto. Recommended as primary seal; final sign-off outstanding. Needs human vector redraw, transparent, monochrome, favicon, and print exports (HQ Section 4A & Plate 1).",
  },
  {
    id: "seed-asset-4a-02",
    name: "Secondary Narrative Seal (offocial logo.png)",
    kind: "logo",
    status: "NEEDS_WORK",
    sourceFilename: "offocial logo.png",
    url: null,
    notes:
      "Circular seal with defeated figure approaching closing lit door. Narrative/campaign variant; filename needs correction; do not overwrite primary seal (HQ Section 4A & Plate 1).",
  },
  {
    id: "seed-asset-4a-03",
    name: "Archived Early Exploration (ChatGPT Image Aug 18, 2026, 03_56_46 PM.png)",
    kind: "logo",
    status: "SUPERSEDED",
    sourceFilename: "ChatGPT Image Aug 18, 2026, 03_56_46 PM.png",
    url: null,
    notes:
      "Early circular fist/rays/defeated-figure emblem without motto. Preserved for lineage/reference only; not part of public identity pack (HQ Section 4A & Plate 1).",
  },
  {
    id: "seed-asset-4a-04",
    name: "Official Ministry Identity (ministry of rejection#.png)",
    kind: "identity",
    status: "NEEDS_WORK",
    sourceFilename: "ministry of rejection#.png",
    url: null,
    notes:
      "Black and red Ministry of Rejection lockups with crown, wreath, and rejected doorway figure. Separate colour versions, transparent/monochrome exports, crest checks, remove '#' from filename (HQ Section 4A & Plate 1).",
  },
  {
    id: "seed-asset-4a-05",
    name: "Primary Movement Hero / Cover (Rejectionism_ The Unapplied Art Movement.png)",
    kind: "banner",
    status: "NEEDS_WORK",
    sourceFilename: "Rejectionism_ The Unapplied Art Movement.png",
    url: null,
    notes:
      "Wide launch banner with founders beneath dominant Rejectionist sun and flying CVs. Main site and social cover use; needs mobile crop, safe-area variants, and web export (HQ Section 4A & Plate 2).",
  },
  {
    id: "seed-asset-4a-06",
    name: "Founders Hero (Rejectionism_ Founding Fathers of Art.png)",
    kind: "banner",
    status: "NEEDS_WORK",
    sourceFilename: "Rejectionism_ Founding Fathers of Art.png",
    url: null,
    notes:
      "Wide banner of the two founders for founder/origin page and press pack. Needs exact public names and titles in accompanying text (HQ Section 4A & Plate 2).",
  },
  {
    id: "seed-asset-4a-07",
    name: "Church Lore Key Art (ChatGPT Image Aug 19, 2026, 12_34_51 AM.png)",
    kind: "artwork",
    status: "NEEDS_WORK",
    sourceFilename: "ChatGPT Image Aug 19, 2026, 12_34_51 AM.png",
    url: null,
    notes:
      "Byzantine-style icon of Church of the Holy Rejection, rejected applicant, sacred bureaucracy, 'Not a fit' desk. Editorial/lore image, not a logo; web crop and alt text required (HQ Section 4A & Plate 2).",
  },
  {
    id: "seed-asset-4a-08",
    name: "Launch Campaign Poster A (banner2.png)",
    kind: "poster",
    status: "NEEDS_WORK",
    sourceFilename: "banner2.png",
    url: null,
    notes:
      "Poster: 'They said no. We built a movement.' Ready for first campaign after copy proof and web/print exports (HQ Section 4A & Plate 3).",
  },
  {
    id: "seed-asset-4a-09",
    name: "Launch Campaign Poster B (banner1.png)",
    kind: "poster",
    status: "NEEDS_WORK",
    sourceFilename: "banner1.png",
    url: null,
    notes:
      "Poster: 'The cult of success sold you a lie. We turn \"no\" into our future.' Ready for first campaign after copy proof and web/print exports (HQ Section 4A & Plate 3).",
  },
  {
    id: "seed-asset-4a-10",
    name: "Canonical Long-Form Text (THE REJECTIONIST MANIFESTO.md)",
    kind: "text",
    status: "APPROVED",
    sourceFilename: "THE REJECTIONIST MANIFESTO.md",
    url: null,
    notes:
      "Full canonical manifesto text. Approved as source text; design as one-page poster/PDF and publish as HTML. Retain uncensored art edition and platform-safe public excerpt (HQ Section 4A & 5).",
  },

  // ---------------------------------------------------------------------------
  // Section 4B — Important Work Established but Absent from Initial Pack
  // ---------------------------------------------------------------------------
  {
    id: "seed-asset-4b-01",
    name: "Alfonso 4-Panel Superhero Origin Comic",
    kind: "comic",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Four-panel masked-superhero origin comic for Alfonso after the 200th final-stage rejection. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-02",
    name: "Michele Grand Architect of No 4-Panel Origin Comic",
    kind: "comic",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Four-panel origin comic for Michele, The Grand Architect of No. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-03",
    name: "Pope Rejectus IV Official Portrait / Icon",
    kind: "artwork",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Official portrait/icon for Pope Rejectus IV, Vicar of the Unshortlisted. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-04",
    name: "Pope Rejectus IV Papal Coat of Arms",
    kind: "identity",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Papal coat of arms for Pope Rejectus IV. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-05",
    name: "Pope Rejectus IV First Miracle Icon",
    kind: "artwork",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Byzantine icon depicting Pope Rejectus IV refusing an enormous pile of money. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-06",
    name: "Church of the Holy Rejection Defeated Knight Crest",
    kind: "identity",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Church crest with defeated armoured knight/crusader and '#' on chest and shield. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-07",
    name: "Ministry of Rejection Keep Calm T-Shirt Design",
    kind: "merchandise",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Ministry of Rejection 'Keep Calm' spoof design. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-08",
    name: "High-Resolution Facebook Launch Assets",
    kind: "social",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "High-resolution Facebook launch images and final cover/avatar exports. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-09",
    name: "Italian RIFIUTAZIONISMO Identity & Banner Variant",
    kind: "identity",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Italian-language RIFIUTAZIONISMO identity lockups and banner variants. Established concept; original master file location unverified (HQ Section 4B).",
  },
  {
    id: "seed-asset-4b-10",
    name: "Archive of No Wireframes and Submission Copy",
    kind: "document",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Archive of No page wireframes and final low-friction submission copy. Established concept; original master file location unverified (HQ Section 4B).",
  },

  // ---------------------------------------------------------------------------
  // Section 4C — Missing Production Assets
  // ---------------------------------------------------------------------------
  {
    id: "seed-asset-4c-01",
    name: "Primary Seal Vector Master (SVG, PDF, Outlined Print)",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Human-cleaned vector master of primary movement seal (SVG, PDF, outlined print version) (HQ Section 4C #1).",
  },
  {
    id: "seed-asset-4c-02",
    name: "Primary Logo Multi-Resolution Pack",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Transparent PNGs at 4096/2048/1024/512, black, white, red/black, icon-only, and horizontal wordmark (HQ Section 4C #2).",
  },
  {
    id: "seed-asset-4c-03",
    name: "Favicons and Social Avatars Pack",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes: "Favicons and social avatars tested at 32-180 px (HQ Section 4C #3).",
  },
  {
    id: "seed-asset-4c-04",
    name: "Approved Founder Portrait Crops and Bios",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes: "Consistent founder names/titles and approved portrait crops (HQ Section 4C #4).",
  },
  {
    id: "seed-asset-4c-05",
    name: "Designed One-Page Manifesto (Screen and Print)",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Designed one-page manifesto layout in web, PDF, and print versions (HQ Section 4C #5).",
  },
  {
    id: "seed-asset-4c-06",
    name: "Multi-Ratio Website and Social Crops Pack",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Website/social crops for every approved image: 1:1, 4:5, 16:9, and mobile hero (HQ Section 4C #6).",
  },
  {
    id: "seed-asset-4c-07",
    name: "Archive of No Dynamic Share-Card Template",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Reusable dynamic share-card template generated from every submission (HQ Section 4C #7).",
  },
  {
    id: "seed-asset-4c-08",
    name: "Rejectionism Press Kit Package",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Press kit ZIP: short description, founder bios, primary seal, Ministry lockup, five approved images, usage notes, and contact (HQ Section 4C #8).",
  },
  {
    id: "seed-asset-4c-09",
    name: "Master Alt Text and Caption Registry",
    kind: "production-export",
    status: "MISSING",
    sourceFilename: null,
    url: null,
    notes:
      "Comprehensive alt text and caption sheet for all canonical artwork (HQ Section 4C #9).",
  },
];
