# Architect identification — Savills-agent applications (last 3 months)

**Date:** 2026-10-04
**Question:** Savills is a planning consultant, not an architect. For applications where
Savills is the agent, can we identify the actual architectural practice from council
portal documents?

**Answer: yes, reliably.** 9 of 10 applications resolved; the 10th has a medium-confidence
hypothesis. The 10 applications collapse to **6 distinct projects / 7 outreach targets**.

## Method (reusable pipeline)

1. `scripts/savills.mjs` — query Supabase for the applications (agent ~ "savills",
   decided ≥ 3 months ago, Permitted/Conditions), join `applications_full` for portal URLs.
2. Fetch the Idox portal **documents tab** HTML (curl) → extract PDF links.
3. `scripts/extract-pdf.mjs <url> [pages] --referer <docsUrl>` — downloads with the
   portal session cookie and extracts text (pdf-parse). Also accepts local file paths.
4. Fastest evidence, in order:
   - **Drawing title blocks** — name the practice + contact details, and the ISO 19650
     originator code (e.g. `LUX03-MAA-…`, `RLE-PRP-…`, `10373-SHP-…`) fingerprints them.
   - **Design & Access Statement** — cover page and "Project Team" section name the architect.
   - **Condition discharges** carry little; trace the **parent permission** (referenced in
     the description / cover letter) and read its DAS instead.
5. Fallbacks when the portal blocks downloads: committee reports
   (democracy.<council>.gov.uk), Planning Inspectorate ACP portal, developer press releases.

## Results

| # | Project | Apps | Architect | Client | Conf. |
|---|---------|------|-----------|--------|-------|
| 1 | 131–139 Ealing Broadway (co-living, 134 units, former Kwik Fit) | 263338NMA, 254019CND | **Matthew Allchurch Architects** | UK Lux One SPV 13 | High |
| 2 | 4 Gladstone Road, Southall (warehouse E(g)(iii)/B8) | 262898CND, 263197NMA | **GRID Architects** | Ginni Enterprise | High |
| 3 | Geoffrey Close Estate, Camberwell (441 homes, 6 blocks) | 26/02259/DET | **PRP Architects** | Lambeth Regeneration LLP / Riverside | High |
| 4 | London Cancer Hub, Sutton (hybrid masterplan) | DM2025/00561 | **Gensler** | Aviva Capital Partners / Socius | High |
| 5 | TwelveTrees Park, Canning Town | 26/01097/AOD | **Patel Taylor** | Berkeley Homes | High |
| 6 | Republic Masterplan, Mulberry Place E14 (BTR + student towers) | PA/26/01316/S, PA/26/01258/S | **SimpsonHaugh** (+ Nicholas Webb: data centre; Studio RHE: workspace/public realm) | EID (General Partner) LLP — LaSalle/Trilogy JV | High |
| 7 | Black Lion House → Hyatt Place, Whitechapel (ancillary floorspace) | PA/26/01324/NC | **Studio Moren** (ex-Dexter Moren) — inferred from the 2018 hotel scheme; verify drawing series "2265" | London East City Hotel | Medium |

## Practice contacts

- **Matthew Allchurch Architects** — The Boathouse, 27 Ferry Road, Teddington TW11 9NN · 020 8973 0050 · info@maa-architects.com
- **GRID Architects** — 128 Southwark Street, London SE1 0SW · +44 (0)20 7593 3260 · info@gridarchitects.co.uk
- **PRP Architects** — prp-co.uk · project lead on Geoffrey Close: Richard Harvey (London)
- **Gensler** — gensler.com (London office: 16 Old Bailey)
- **Patel Taylor** — 48 Rawstorne Street, London EC1V 7ND · +44 (0)20 7278 2323 · pateltaylor.co.uk
- **SimpsonHaugh** — 5–8 Roberts Place, London EC1R 0BB · +44 (0)20 7549 4000 · mail@simpsonhaugh.com
- **Studio Moren** — 57d Jamestown Road, London NW1 7DB · +44 (0)20 7267 4440 · studio@studiomoren.co.uk

## Portal quirks discovered

- **Lambeth / Ealing / Newham / Sutton** (Idox): PDF downloads need the session cookie
  from the documents page (handled by `--referer` in extract-pdf.mjs). No CAPTCHAs.
- **Tower Hamlets**: PDF downloads hard-blocked — invisible reCAPTCHA v3 tokens that
  fail for automation, and some documents now return "no permission" even for manual
  downloads (possibly account-gated; a portal registration might unlock them).
  Workarounds that succeeded: application summary tab (plain HTML), committee reports on
  democracy.towerhamlets.gov.uk, Planning Inspectorate ACP portal, developer press.

## Implications for the app (Phase 4)

- Group leads by **project** (parent reference + normalised address), not application —
  10 Savills rows were really 6 schemes. Emailing a practice once per project matches the
  roadmap's "one email per practice" goal.
- `agent_display` alone can't distinguish planner vs architect — classification needed.
- An "architect evidence" field (source doc URL + quote) would make enrichment auditable.
