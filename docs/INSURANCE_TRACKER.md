# AgriPod — Crop-Insurance **Tracker & Escalation** (pivot)

> Companion to `TECHNICAL_APPROACH.md` §M4. Supersedes the "build a claims system" framing
> of the Deep-AI M4 module. Last updated: 2026-09-08.

---

## 1. The pivot — what changes

**Old M4 (drop this framing):** AgriPod runs its own claim intake → AI damage assessment →
officer approve/reject → payout. That silently re-implements the government's automated
crop-insurance pipeline, which we cannot and should not replace.

**New M4:** AgriPod is a **transparency + tracking + escalation layer on top of PMFBY**
(Pradhan Mantri Fasal Bima Yojana), the government scheme. We do **not** touch the money or
the decision. We do four things the government pipeline does badly for the farmer:

| We do | We do **not** do |
|---|---|
| Mirror the claim's real status in plain Tamil/English | Calculate the claim amount |
| Time each stage against the official SLA, flag delays | Approve / reject a claim |
| Assist the 72-hour loss report (guided, pre-filled, hand-off) | Conduct the survey / CCE |
| Route an escalation to the *correct* officer for that district & stage | Disburse or hold money |

Rationale: the automated PMFBY claim engine (area-yield + YES-TECH + DigiClaim + PFMS) is
already national infrastructure. The gap a farmer actually feels is **"where is my claim,
is it stuck, and who do I call"** — that is a pure information + routing problem, and it is
implementable by us without owning any regulated function.

---

## 2. The real government flow, step by step

For **each step**: ① where the data comes from (site + department), ② which department we
collaborate with so the farmer sees live progress, ③ what (if anything) we write back and
to which portal.

PMFBY today runs on the **National Crop Insurance Portal (NCIP, `pmfby.gov.in`)** with
sub-systems: **AIDE/Sahayak** (doorstep enrolment), **CCE-Agri / YES-TECH** (yield),
**WINDS** (weather stations), **CROPIC** (geo-tagged crop monitoring), **DigiClaim**
(auto claim calc + disbursal via **PFMS**), and **KRPH** — Krishi Rakshak Portal & Helpline
**14447** (grievances, launched Feb 2024).

### Step 0 — Enrolment / policy in force

| | Detail |
|---|---|
| **① Data from** | Farmer's own **acknowledgement slip / enrolment SMS** (Application No., season, crop, Insurance Unit, insurer, Sum Insured). Cross-check: NCIP **"Application Status"** page (`pmfby.gov.in` → keyed by application number). Public reference: **data.gov.in** PMFBY coverage datasets; the season's **insurer-allocation notification** and **notified-crops/cut-off** circular published by the **State Dept of Agriculture** (in TN: Dept of Agriculture & Farmers' Welfare) on the state agri portal. |
| **② Collaborate with** | **DA&FW Crop Insurance Division** (owns NCIP) for a **read-only policy-status API keyed by application number + farmer OTP consent** — same class of scoped access banks, CSCs and AIDE intermediaries already hold. State Nodal Dept for the notification PDFs. |
| **③ Write to** | Nothing. Enrolment is done through bank / CSC / AIDE / NCIP self-service before AgriPod is involved. We only **read + store a copy** of the policy. |

### Step 1 — Loss event & intimation (**72-hour** window)

| | Detail |
|---|---|
| **① Data from** | The farmer (event type, date, affected area). Corroboration we can pull **openly**: **IMD** district/block rainfall & warnings, **WINDS** AWS/ARG readings, **Bhuvan / MOSDAC / NRSC** flood & drought layers — to independently confirm "yes, 90 mm fell on your block that day". |
| **② Collaborate with** | The **allocated Insurance Company** (per cluster per season) and the **District/Block Agriculture Office** — both are official intimation receivers and can confirm a docket was created. **KRPH (14447)** as a status source once a docket exists. |
| **③ Write to** | **Hand-off, not submit.** We open a **pre-filled** intimation in the official **Crop Insurance App** / `pmfby.gov.in` **"Report Crop Loss"** / dial **14447**, or the insurer's app. The farmer submits; we capture the **Docket/Intimation ID** they get back. (Phase 2, only with a DA&FW MoU: push our geotagged loss photos + AI pre-assessment into the docket as *supporting evidence*, never as the assessment.) |

### Step 2 — Loss assessment (individual survey **or** area-yield)

| | Detail |
|---|---|
| **① Data from** | **Localised / post-harvest / mid-season** losses → **joint field survey**: insurer's loss assessor + **State Agriculture Dept** official; assessor to be deputed **within 48–72 hrs** of intimation. **Widespread** losses → **Crop Cutting Experiments (CCE)** at the Insurance-Unit level by the **State Dept of Agriculture / Directorate of Economics & Statistics (DES)** — in TN, **DES conducts CCEs** — logged in the **CCE-Agri app**, augmented by **YES-TECH** remote-sensing yield and **WINDS** weather indices. |
| **② Collaborate with** | **State Agriculture Dept + DES** for the **CCE calendar and results** for the farmer's Insurance Unit, and the **insurer** for the **survey date / surveyor name / survey report status**. This is the stage with the worst visibility today — a data-sharing MoU here is the highest-value one. |
| **③ Write to** | Nothing. If a survey is overdue we generate a **reminder** to the insurer district office + Block AO (Step 6 routing), we do not file the report. |

### Step 3 — Claim calculation (PMFBY formula, run by the insurer on NCIP)

| | Detail |
|---|---|
| **① Data from** | NCIP / DigiClaim once computed. We can **explain and pre-estimate** the number ourselves from public inputs: **Threshold Yield** (avg of best 5 of last 7 years × indemnity level 70/80/90%) from **DES yield tables**, **Sum Insured** = Scale of Finance × insured area from the **SLBC / District Level Technical Committee** notification, **Actual Yield** from published CCE/YES-TECH. Formula (area approach): `Claim = ((Threshold Yield − Actual Yield) / Threshold Yield) × Sum Insured`. Prevented-sowing = 25% SI; localised = assessed-loss% × SI × affected-area share. |
| **② Collaborate with** | **DA&FW / NCIP** for the **computed claim amount + status** on the claim-status API. **DES** for the yield tables that let us show *how* the number was reached. |
| **③ Write to** | Nothing. We show a **"how this was calculated"** breakdown so the farmer can sanity-check it — this is what makes a later dispute credible. |

### Step 4 — Approval / rejection

| | Detail |
|---|---|
| **① Data from** | NCIP claim-status API: `enrolled → claim generated → under process → approved / rejected / paid`. Rejection reason codes where exposed. Disputes at this stage go to the **State Technical Advisory Committee (STAC)** / **District Level Monitoring Committee (DLMC)**. |
| **② Collaborate with** | **DA&FW Crop Insurance Division** for status + reason codes; **State Nodal Officer (Crop Insurance)** for STAC/DLMC agenda visibility. |
| **③ Write to** | Nothing yet. If **rejected or under-assessed**, this is the trigger for the **escalation flow** (Step 6). |

### Step 5 — Disbursement (**DigiClaim → PFMS → DBT**)

| | Detail |
|---|---|
| **① Data from** | **DigiClaim** module on NCIP (auto-calculated, auto-disbursed) → **PFMS** → Aadhaar-linked **NEFT** to the farmer's account. Farmer receives an SMS; bank statement shows the credit. Public: **DigiClaim dashboard** aggregate stats. |
| **② Collaborate with** | **DA&FW / NCIP-PFMS** for a **payment-status** flag on the claim API (`initiated / returned / credited`, date, amount, UTR). |
| **③ Write to** | Nothing. We reconcile the SMS/API against the claim amount and flag **short-payment** or **"approved but not paid past SLA"** (PMFBY mandates **12% penal interest** to the farmer for insurer delay — we surface that entitlement). |

### Step 6 — Farmer response: agree, or escalate

| | Detail |
|---|---|
| **① Data from** | Farmer's decision. Our **delay/short-payment detector** (elapsed vs SLA at each stage). The **escalation ladder + officer directory** (§3). |
| **② Collaborate with** | **KRPH (portal + 14447)** — the official single-window grievance channel; **District Grievance Redressal Committee (DGRC)** / **DLMC** chaired by the **District Collector**, with the **Joint Director of Agriculture** as member-secretary; **State Grievance Redressal Committee (SGRC)**; Insurance **Ombudsman (IRDAI)**; **CPGRAMS** (`pgportal.gov.in`). |
| **③ Write to** | **This is the one place we write.** An escalation from AgriPod: (a) if a **KRPH grievance API** is granted → files a real docket and tracks its ID; (b) else → generates a **pre-filled grievance** (policy no., full timeline, SLA breached, specific ask) in **English + Tamil** and one-taps into **KRPH web form / email to DGRC + JDA / CPGRAMS / call 14447**. Every escalation is logged locally so the farmer has a paper trail and we can auto-nudge for follow-up. |

---

## 3. The escalation ladder & the **per-district officer**

The farmer's question is "who do I go to next". The answer is a fixed ladder; only the
**names/contacts change per district and per season**, so we maintain a directory.

| Rung | Who | Role in PMFBY | When AgriPod routes here |
|---|---|---|---|
| **L1 — Block** | **Agricultural Officer (AO)** / Assistant Director of Agriculture, block | First point of contact; co-signs joint surveys | Survey not scheduled; enrolment/data-entry error |
| **L2 — District (primary)** | **Joint Director of Agriculture (JDA)** — *"Deputy Director of Agriculture (DDA)"* in many other states | **District PMFBY nodal officer**; member-secretary of the DGRC | Survey/CCE overdue, claim stuck > SLA, wrong Insurance Unit |
| **L2b — District grievance body** | **DGRC / DLMC**, **chaired by the District Collector / District Magistrate**; members: JDA (secy), Lead Bank Officer, insurer district manager, farmer representatives | Formal grievance forum | Rejection dispute; JDA unresponsive |
| **L3 — State** | **State Nodal Officer, Crop Insurance** (Jt./Addl. Director, State Agri Dept) + **SGRC**; reports to **Agricultural Production Commissioner / Principal Secretary (Agriculture)** | State-level dispute resolution, STAC | DGRC unresolved > 30 days |
| **L4 — Parallel / external** | **KRPH 14447**, **Insurance Ombudsman (IRDAI)** for the zone, **CPGRAMS**, consumer forum / Lok Adalat | Independent redress | Any time; always offered alongside L2–L3 |
| **Also always shown** | **Allocated insurer's district/branch office** for that cluster & season | Claim servicer | Payment/short-payment issues |

### Tamil Nadu specifics (demo context)

- **State Nodal Dept:** Tamil Nadu **Department of Agriculture and Farmers' Welfare**;
  **DES (Dept of Economics & Statistics)** runs CCEs.
- **District rung = Joint Director of Agriculture (JDA)**, one per district, seated at the
  district collectorate / district agri office. Each TN district's `*.nic.in` portal
  publishes a **PMFBY page** listing the JDA, the block AOs, the allocated insurer and the
  grievance contact (e.g. `tiruchirappalli.nic.in/pmfby/`).
- Chennai district itself has almost no PMFBY footprint (urban). The demo districts that
  matter are the peri-urban/agri belt: **Tiruvallur, Chengalpattu, Kancheepuram, Cuddalore,
  Villupuram**, and the Cauvery-delta districts.
- TN also runs the **"Uzhavan" app** (state agri dept) — a candidate integration/redirect
  target for scheme info.

### Directory data — how we build & keep it

`district → { blockAOs[], jointDirectorAgri{name,office,phone,email}, collectorate_pmfby_cell,
dgrc_secretary, allocated_insurer{name, district_office, toll_free}, state_nodal_officer,
last_verified }`

- **Seed** from: state agri dept website, each district `*.nic.in` PMFBY page, the **KRPH
  escalation matrix**, and the **season's insurer-allocation gazette**.
- **Refresh** every season (insurer changes) + quarterly (officer transfers). Light admin
  CMS in the officer dashboard; plus a farmer-facing **"this contact is wrong"** button that
  raises a data-fix task.
- Until a state MoU: this is **manually curated**, starting with the ~6 TN demo districts.
  That is enough for the hackathon and is honest about scope.

---

## 4. What we build — feature spec

**Farmer app — "Insurance" tab becomes "Insurance Tracker":**

1. **My policy** — add once from the acknowledgement slip/SMS (OCR assist). Fields:
   application no., season, crop, Insurance Unit, insurer, sum insured, area. Optional
   one-time NCIP status-check to verify.
2. **Status timeline** — the six stages of §2 as a vertical stepper, in Tamil/English:
   what the stage means, who owns it, the **official SLA vs elapsed time**, expected next
   date. Source: SMS parse + periodic NCIP status check + our district-timing model
   (from data.gov.in history).
3. **Delay & short-payment detector** — compares elapsed time at the current stage to the
   PMFBY operational-guideline SLA; on breach → red banner + **"Escalate"**. Also detects
   *approved-but-unpaid* and computes the **12% penal-interest** entitlement.
4. **Loss-report assistant** — 72-hour countdown, evidence checklist, guided geotagged
   photos, weather corroboration card (IMD/WINDS), then **pre-filled hand-off** to the
   Crop Insurance App / KRPH. Stores the returned docket ID.
5. **Escalation router** *(the new core value)* — given district + stage + delay reason,
   pick the rung (§3), show that officer's name/office/phone/email/role, generate a
   ready-to-send bilingual grievance (policy no., timeline, SLA breached, specific ask),
   one-tap → call / SMS / email / KRPH form / CPGRAMS, and **log it** with a follow-up nudge.
6. **"How was my claim calculated"** — the Step-3 formula breakdown from public yield/SI
   data, so a dispute is evidence-backed.

**Officer dashboard:**

- **Officer directory CMS** (§3) — editable, versioned, `last_verified` per row.
- **Escalations inbox** — grievances raised through AgriPod for this officer's district,
  with the farmer's timeline attached; mark acknowledged / in-progress / resolved. This is
  what the farmer's app polls for "your escalation was seen".
- Feeds the existing outbreak/alert dashboard with an **insurance-delay heatmap** per block
  (useful signal for the district administration).

---

## 5. Data-acquisition reality & phasing

| Capability | Phase 0 (hackathon, no MoU) | Phase 1 (DA&FW MoU) | Phase 2 (State MoU) |
|---|---|---|---|
| Policy details | Farmer-entered + OCR | NCIP policy API + OTP consent | + AgriStack Farmer-ID verification |
| Claim status | SMS parse + consented NCIP status-page check for the farmer | NCIP **claim-status API** (real-time) | + STAC/DLMC agenda visibility |
| Payment status | Farmer's bank SMS | NCIP–PFMS payment flag (UTR, date) | — |
| Survey / CCE status | Farmer report + insurer phone | Insurer survey API | **DES CCE calendar + results feed** |
| Loss intimation | Deep-link hand-off to Crop Insurance App / 14447 | KRPH intimation API | Evidence push into docket |
| Escalation | Pre-filled KRPH form / email / CPGRAMS | **KRPH grievance API** (real docket + tracking) | Direct DGRC case status |
| Officer directory | **Manually curated, 6 TN districts** | State-published officer API | Live from state HRMS |

**Honest limitation to state up front:** there is **no public open API for an individual
PMFBY policy/claim status** today. Phase 0 works via SMS parsing + farmer-consented
status-page lookups + a hand-curated directory — a genuinely useful product, just not
real-time. Everything real-time needs the MoUs in Phase 1/2.

---

## 6. Backend sketch

```
insurance_policy_ref      -- the farmer's PMFBY policy, as they entered / we verified it
  id, farmer_id, application_no, season, crop, insurance_unit,
  insurer_name, sum_insured, area_acres, source('manual'|'ocr'|'ncip'),
  ncip_verified_at, created_at

claim_track               -- one tracked claim against a policy
  id, policy_ref_id, farmer_id, docket_id, cause, incident_date,
  stage('enrolled'|'reported'|'survey'|'calculated'|'decided'|'paid'),
  stage_since, expected_next_at, sla_breached bool,
  decided_outcome('approved'|'rejected'|null), amount_expected, amount_paid,
  paid_utr, paid_at, updated_at

claim_track_event         -- timeline entries (from SMS parse / NCIP poll / farmer)
  id, claim_track_id, source('sms'|'ncip'|'farmer'|'officer'), kind, body, at

escalation                -- what we route out
  id, claim_track_id, farmer_id, rung('L1'|'L2'|'L2b'|'L3'|'L4'),
  officer_ref, channel('call'|'sms'|'email'|'krph'|'cpgrams'),
  krph_docket_id, letter_text_en, letter_text_ta,
  status('drafted'|'sent'|'acknowledged'|'in_progress'|'resolved'),
  sent_at, last_nudge_at

officer_directory         -- §3, admin-maintained
  district, rung, name, designation, office, phone, email,
  insurer_name, insurer_office, last_verified, verified_by
```

SMS parsing: a small rules table of PMFBY/insurer sender IDs + message templates →
`claim_track_event` + stage transition. NCIP poll: consented, low-frequency, backs off on
failure; never stores the farmer's OTP.

---

## 7. Partnership asks (for the pitch)

1. **DA&FW, Crop Insurance Division** — read-only **policy + claim + payment status API**
   keyed by application number with farmer OTP consent; **KRPH grievance-submission API**.
   *(Precedent: banks, CSCs, AIDE intermediaries already hold scoped NCIP access.)*
2. **State Dept of Agriculture + DES (Tamil Nadu)** — data-sharing for the **CCE
   calendar/results**, the **season insurer-allocation**, and the **district officer
   directory**; a redirect/integration with the **Uzhavan** app.
3. Until then, Phase 0 ships on public + farmer-provided data and a hand-curated directory.

---

## Sources

- [PMFBY / NCIP official portal](https://pmfby.gov.in/)
- [KRPH — Krishi Rakshak Portal & Helpline 14447](https://pmfby.gov.in/krph/)
- [PIB — DigiClaim launch (NCIP × PFMS)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1909895)
- [PIB — KRPH / SARTHI / LMS launch, 14447](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2004173)
- [PIB — Digitalization of PMFBY (YES-TECH, WINDS, CROPIC)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1982800)
- [PMFBY revised Operational Guidelines (PDF)](https://pmfby.amnex.co.in/pmfby/pdf/operational_guidelines_pmfby.pdf)
- [AIDE / Sahayak doorstep-enrolment app](https://play.google.com/store/apps/details?id=com.application.pmfby.aide)
- [AgriStack — Farmer Registry](https://agristack.com.in/)
- [Tamil Nadu Dept of Agriculture & Farmers' Welfare](https://en.wikipedia.org/wiki/Department_of_Agriculture_(Tamil_Nadu))
- [TN DES — PMFBY / Crop Cutting Experiments](https://des.tn.gov.in/en/node/15)
- [Example district PMFBY page — Tiruchirappalli](https://tiruchirappalli.nic.in/pmfby/)
- [SBI General — PMFBY claim process & 72-hour rule](https://www.sbigeneral.in/claimprocess)
- [Practical guide — claim not paid, grievance & RTI for yield data](https://righttoinformation.wiki/practical-guides/crop-insurance-claim-not-paid-pmfby)
