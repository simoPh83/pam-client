# Planning application types — what they mean for construction timing

Sources: [Planning Geek – types](https://www.planninggeek.co.uk/applications/types/),
[discharge of conditions](https://www.planninggeek.co.uk/applications/discharge-of-conditions/),
[Section 73](https://www.planninggeek.co.uk/applications/section-73-amendment/).
Secondary sources, summarising TCPA 1990 and the DMPO. Checked 2026-10-10.
PlanIt's own `app_type` taxonomy is **not** documented there; its mapping must be measured from our data
(see [open-questions.md](open-questions.md)).

## Application families and the timing signal each gives

| Type | What it is | Timing signal |
|---|---|---|
| Full | Whole scheme decided at once. | Permission granted; clock starts. |
| Outline | Principle only; detail comes later. | **Early.** Needs reserved matters before any build. Large schemes with only outline = very early. |
| Reserved matters | Detail approval under an outline. Deadline is 3 years from the outline grant. | Moves an outline scheme towards start; look for it after an Outline. |
| Householder | Works to a house. 8-week decision. | Short lag, short build. |
| Permission in principle + technical details | Up to 9 dwellings. | Technical details consent is the real permission. |
| Discharge of conditions (art. 27 DMPO) | Approval of materials, drainage, construction management plan, etc. Not a planning application in the usual sense. | **Strong.** Pre-commencement conditions must be discharged *before* a lawful start, so a discharge means start is near or has happened. Later-stage conditions (materials, landscaping, occupation) mean construction is well under way. |
| Section 73 (vary conditions) | New free-standing permission with changed conditions, often changed approved plans. | Scheme live and being redesigned. Does **not** extend the expiry date. Mid-design, not proof of building. |
| Section 96A non-material amendment | Minor change to an existing permission. | Scheme live. Weak timing signal. |
| Prior approval / prior notification | Permitted-development routes (e.g. conversions, larger home extensions, demolition notification). | Prior notification of demolition is a direct pre-start sign. |
| Lawful development certificate | Confirms lawfulness. Grants nothing. | Not a start signal by itself. |
| Advertisement, trees, hazardous substances | Separate controls. | Mostly irrelevant. Trees is already excluded from `leads`. |
| Pre-application advice | Informal, before applying. | Very early; probably not in the data. |

## Rules that matter for the algorithm

- **Commencement deadline:** normally 3 years from grant (5 in some boroughs such as Enfield, per earlier notes). A decision
  older than that with no activity is a dead-permission candidate, unless a start was made.
- **Condition discharge is slow:** statutory 8 weeks; practitioners suggest planning for 12–16. A discharge *filed* is
  earlier evidence than one *decided*. Use both dates separately.
- **Deemed discharge:** after 6 weeks an applicant can serve a notice and the condition is treated as discharged with no
  decision. So some projects start with no decided discharge on record.
- **Pre-commencement vs later conditions:** the condition text distinguishes "about to start" from "building". Description keywords
  (e.g. "demolition", "construction management", "contamination", "drainage" vs "materials", "landscaping", "cycle store",
  "external finishes") may separate them. This is hypothesis H-KW in [algorithm.md](algorithm.md).
- **Reserved matters deadline:** 3 years from the outline grant, the other hard clock.
- **s73 does not extend time**, so a chain of s73s never resets the expiry date.
- A permission can be **implemented in breach** of an undischarged pre-commencement condition, which is a legal
  grey area. The data can't distinguish this case.
- Fees for discharge of conditions rise on 8 Dec 2026. This may shift filing behaviour in the data from then on.
