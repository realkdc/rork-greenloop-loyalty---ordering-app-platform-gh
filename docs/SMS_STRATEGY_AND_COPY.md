# SMS Strategy & Copy — Plug‑and‑Play

Lean winback + AOV, under budget, compliance‑safe (no product words in SMS body).

---

## How it all works (breakdown)

**What we’re doing:** Only texting **lapsed** customers (and a couple of one‑time flows). No “all customers” blasts. Everything goes to a **perk page** behind a link; the SMS never mentions product, discounts, or dollars.

---

### 1. Who gets texts (4 groups)

| Who | When they get it | How many texts |
|-----|------------------|----------------|
| **60d** (60–89 days since last order) | Winback A — “Member Perk” | 3 within 72h |
| **90d** (90+ days since last order) | Winback B — “Comeback Perk” | 3 within 72h |
| **New / first purchase** | Welcome + “Second Visit” | 2 (welcome now, second-visit at day 5) |
| **Has phone, no app** | App install nudge | 2 (now + 48h) |

We **only** use your existing **Inactive Segment** from `customer_analytics_master.csv`: **60d** and **90d**. No new segments, no formulas. Export where `Inactive Segment` = 60d or 90d and `Phone` is not blank.

---

### 2. What every text does

- Says there’s a **perk** ready.
- Says it **ends in 72 hours**.
- One CTA: **Claim** or **Tap** → goes to `{LINK}` (age‑gated perk page).
- No product words, no dollar amounts in the SMS. Those go on the **page behind the link**.

---

### 3. If they already came back → stop

For **Winback A and B**, if they **redeem** (claim on the perk page, use in‑store, or buy within your defined window), **stop** the rest of that 3‑text sequence. You have to define “redeem” in your system and wire that into your SMS tool (see §2.3).

---

### 4. Caps and compliance

- **Volume cap:** 2,400/mo (Basic) or 1,700/mo (Gold). If you hit it, pause until next month.
- **Opt‑in** must cover: STOP, HELP, msg & data rates, frequency. **Welcome SMS 1** includes STOP, HELP, and “Msg&data rates may apply” once.
- **Batching:** 60d and 90d are capped to **N people/month each** so you don’t blow the cap; see §5.

---

### 5. Names and fixed stuff

- **{STORE}** = GreenHaus, **program** = GreenHaus Crew.
- **Expiry** = “Ends in 72 hours” in every text. No “Sunday” or “Jan 19.”
- **Perk codes** (behind the link): `WINBACK60` (60d), `COMEBACK90` (90d), `SECONDVISIT`.

---

### 6. The link (perk page)

The **{LINK}** in every SMS goes to an **age‑gated** page. There you can say: “200 bonus points,” “$5 off,” “$10 off $50+,” etc. The page has the real offer and 72h expiry; the SMS only drives tap/claim.

---

## 1. How this lines up with `customer_analytics_master.csv` and Lightspeed — **no mismatch**

The SMS strategy uses the **same segments** as your CSV and `lightspeedCustomerLookup`: **60d** and **90d**. No derived logic, no extra columns.

### How the data is already segmented

**customer_analytics_master.csv** (column **Inactive Segment**):

| Inactive Segment | Days Since Last Order | Count (≈) |
|------------------|------------------------|-----------|
| **active**       | 0–29                  | ~1,853    |
| **30d**          | 30–59                 | ~661      |
| **60d**          | 60–89                 | ~593      |
| **90d**          | 90+                   | ~6,017    |

**lightspeedCustomerLookup.ts** (`inactiveSegment` from `lastOrderDate`):

- `active` &lt; 30 | `30d` 30–59 | `60d` 60–89 | **`90d+`** 90+

Same day bands; the CSV uses **90d**, Lightspeed uses **90d+** for 90+.

### How the SMS strategy uses these segments

| SMS campaign  | Inactive Segment | Purpose        |
|---------------|------------------|----------------|
| **Winback A** | **60d** (60–89)  | Member Perk    |
| **Winback B** | **90d** (90+)  | Comeback Perk  |

- **60d** → Member Perk (warmer, 60–89 days since last order).  
- **90d** / **90d+** → Comeback Perk (colder, 90+ days; slightly stronger offer on the perk page).

### Filter logic (use Inactive Segment directly)

**From customer_analytics_master.csv:**

| Campaign   | Include rows where                                      |
|------------|----------------------------------------------------------|
| Winback A  | `Inactive Segment` = **60d** and `Phone` is not blank    |
| Winback B  | `Inactive Segment` = **90d** and `Phone` is not blank    |

**From Lightspeed / `inactiveSegment`:**  
Winback A → `inactiveSegment === '60d'`; Winback B → `inactiveSegment === '90d+'` (same 90+ day band as CSV’s 90d).

---

## 2. Cost, compliance & operations

### 2.1 Monthly SMS volume cap (SOP)

The **$50–$150/mo** cost promise only holds with a **hard cap**. Write this into your client agreement or internal SOP:

- **Monthly SMS cap:** **2,400 texts/mo** (Basic) or **1,700 texts/mo** (Gold)
- **If you exceed the cap:** Pause all broadcasts until the next month. Do not roll over.

This makes the budget defensible instead of “hope marketing.”

### 2.2 STOP / HELP and opt‑in disclosures

Your flow copy is fine **if** the opt‑in process already covers:

- **"Reply STOP to opt out"**
- **"Reply HELP for help"**
- **"Msg & data rates may apply"**
- **Frequency statement** (e.g. “up to X msgs/month”)

**Fix:** Include STOP, HELP, and **“Msg&data rates may apply”** at least once—in **Welcome SMS 1** (see §4.3). You do **not** need them in every message if the rest of compliance is in place, but they must appear somewhere reliable.

### 2.3 Redemption suppression — define it operationally

“Stop if they redeem” must be **bulletproof**, or you’ll keep texting buyers and spike unsubscribes.

**Define “redeem” as one of (pick what you can enforce):**

1. **Perk page claim event** (e.g. click/claim on the age‑gated page), or  
2. **In‑store redemption event** (POS or staff marks perk used), or  
3. **Purchase within X hours of click/claim** (if tracking is limited; e.g. 72h).

**Use one primary trigger** (e.g. perk page claim) in your system so suppression actually runs. If you don’t define and implement this, the system will keep sending the sequence after they’ve already acted.

### 2.4 Naming in SMS

- **{STORE}** = **GreenHaus**
- **Program** = **GreenHaus Crew**

Use both consistently. No “Greenhouse” or “GreenLoop” in customer‑facing SMS.

### 2.5 Cannabis / THCA‑hemp compliance (TCPA, 10DLC, carriers)

**Not legal advice.** Align with counsel and any guide you use (e.g. *Compliance and Legal Considerations for Cannabis (THCA Hemp) SMS and Email Marketing*).

- **Consent (TCPA):** Prior express **written** consent for marketing SMS. A phone from a prior purchase is **not** enough. At opt‑in: who (GreenHaus), that it's marketing, frequency, msg & data rates, how to opt out (STOP). Affirmative action (no pre‑checked box). Brand‑specific.
- **Opt‑out:** Reply STOP/HELP; honor promptly; keep a Do‑Not‑Text list; never re‑add without new consent.
- **Age:** 21+ at opt‑in; age‑gate the perk page (this playbook assumes it).
- **No product/cannabis words in SMS:** Already in place—perk, claim, link only. Carriers/SHAFT treat cannabis as high‑risk.
- **10DLC/TCR:** Register brand and campaigns with your provider / The Campaign Registry.
- **SMS provider:** Many ban cannabis/hemp; vet yours.
- **Records:** Keep consent (date, IP, wording, age).
- **Penalties:** $500–$1,500 per violation; class actions common.

**What this playbook already does:** No product words; STOP/HELP/rates in Welcome 1; link to age‑gated page; redemption suppression. **What you must add:** Written opt‑in with the disclosures above (don't assume purchase = consent); 10DLC registration; age at opt‑in; Do‑Not‑Text list.

---

## 3. Placeholders (swap in your ESP)

| Placeholder | Value |
|-------------|--------|
| `{FIRST}` | First name |
| `{STORE}` | **GreenHaus** |
| `{LINK}` | Tracked link to age‑gated perk page (or in‑app deep link) |

**Fixed (no placeholder):** Expiry = **"Ends in 72 hours"** everywhere. Member Perk / Comeback Perk are inlined in the copy below.

---

## 4. Final copy — exact wording, timing, stop conditions

### 4.1 Winback A — 60d (3 texts, within 72h)

**“Ends in 72 hours” is true:** the sequence runs in 72h so the claim window doesn’t lie.  
**Stop:** If they redeem after any SMS, **do not** send the rest. (See §2.3.)

| # | When | Copy |
|---|------|------|
| 1 | **0h — Day 0, 10am** | `{FIRST}, your {STORE} Member Perk is ready. Ends in 72 hours. Claim: {LINK}` |
| 2 | **+24h — Day 1, 4pm** | `Quick nudge: your Member Perk is still unclaimed. Ends in 72 hours. Claim: {LINK}` |
| 3 | **+70h — Day 2, 8pm** | `Last call—Member Perk ends in 72 hours. Claim now: {LINK}` |

**Example:**  
`Jordan, your GreenHaus Member Perk is ready. Ends in 72 hours. Claim: https://…`

---

### 4.2 Winback B — 90d (3 texts, within 72h)

**Same timing as Winback A** so “Ends in 72 hours” is true.  
**Stop:** If they redeem after any SMS, **do not** send the rest. (See §2.3.)

| # | When | Copy |
|---|------|------|
| 1 | **0h — Day 0, 10am** | `{FIRST}, we saved a one‑time {STORE} Comeback Perk for you. Ends in 72 hours. Claim: {LINK}` |
| 2 | **+24h — Day 1, 4pm** | `Still want your comeback perk? Ends in 72 hours. Tap: {LINK}` |
| 3 | **+70h — Day 2, 8pm** | `Final reminder—comeback perk ends in 72 hours. Claim: {LINK}` |

**Example:**  
`Zack, we saved a one‑time GreenHaus Comeback Perk for you. Ends in 72 hours. Claim: https://…`

---

### 4.3 Welcome + Second Visit (2 texts)

**STOP + HELP + rates:** Welcome SMS 1 includes STOP, HELP, and “Msg&data rates may apply” once. (See §2.2.)  
**Stop:** If they redeem the Second Visit perk, **do not** send SMS 2.

| # | When | Copy |
|---|------|------|
| 1 | **Right after opt‑in / first purchase** | `Welcome to {STORE} Crew 🌿 Your perks: {LINK} Reply STOP to opt out, HELP for help. Msg&data rates may apply.` |
| 2 | **Day 5** | `Your "Second Visit" perk ends in 72 hours. Tap to use it next time: {LINK}` |

**Example:**  
`Welcome to GreenHaus Crew 🌿 Your perks: https://… Reply STOP to opt out, HELP for help. Msg&data rates may apply.`

---

### 4.4 App install nudge (2 texts, non‑app users)

**Stop:** If they install and claim, optionally suppress SMS 2 (depends on your tracking).

| # | When | Copy |
|---|------|------|
| 1 | **Day 0** | `Your {STORE} perks are unlocked in the app. Install + claim: {LINK}` |
| 2 | **48 hours later** | `Reminder: perk access ends in 72 hours. Install + claim: {LINK}` |

**Example:**  
`Your GreenHaus perks are unlocked in the app. Install + claim: https://…`

---

## 5. Budget / sends

- **No “All Customers”** blasts.
- **Only** 60d and 90d for winback; one 3‑text sequence per segment per month.
- Welcome + Second Visit + App Nudge: as triggered by signup / first purchase / non‑app, not counted as “campaign blasts” in the same way.
- **Volume cap:** See **§2.1** (2,400 Basic / 1,700 Gold; pause if exceeded).

### 5.1 Batching (90d will blow the cap if you don’t throttle)

~6,017 in 90d × 3 texts = **18,051 texts**—not a $50–$150/mo program. You **must** cap how many people get the winback sequence each month.

**Rule:**

- **N** = `floor((MonthlyCap − ReserveForWelcomeApp) / 6)`.  
  - Reserve ≈ **600** for Welcome, App, Second Visit.  
  - Basic (2,400): (2,400 − 600) / 6 = **300 people per segment per month** (300 × 3 = 900 for 60d, 300 × 3 = 900 for 90d = 1,800; 1,800 + 600 = 2,400).
- **SOP:** Each month, send to only the **first 300** from the 60d export and the **first 300** from the 90d export.  
- **Rotate:** Next month use the *next* 300 (rows 301–600), etc., so over time everyone in 60d/90d gets a turn.

**Gold (1,700):** (1,700 − 600) / 6 ≈ **183 per segment**; same batching logic.

---

## 6. Perk page (behind the link)

On the age‑gated page (or in‑app screen), you can say things you **cannot** put in the SMS, e.g.:

- **Member Perk (60d):** e.g. “200 bonus points” or “$5 off next order” + short terms.
- **Comeback Perk (90d):** e.g. “500 bonus points” or “$10 off $50+” + short terms.
- **Second Visit:** e.g. “200 points” or “10% off” + terms.
- **App perk:** same as one of the above, with “claim in app” CTA.

All with a clear **expiry (72h)** and age gate. If you lock in specific perk amounts (e.g. 200 vs 500 points) or spend thresholds for AOV, we can tune the on‑page messaging without putting those details in the SMS body.

---

## 7. Ship order

So this actually runs clean:

1. **Pick plan + set monthly SMS cap** — Write 2,400 (Basic) or 1,700 (Gold) into your client agreement or internal SOP (§2.1).
2. **Build two lapsed exports** — 60d and 90d, from §1: `Inactive Segment` = 60d or 90d, and `Phone` not blank.
3. **Create two perk codes** — `WINBACK60` (60d) and `COMEBACK90` (90d); enforce `maxRedemptionsPerUser: 1`.
4. **Implement Winback A + B** — 3 texts within 72h (0h / +24h / +70h), redemption suppression per §2.3; **batch** 60d and 90d per §5.1.
5. **Add Welcome + Second Visit** — 2 texts; STOP, HELP, and “Msg&data rates may apply” in Welcome 1 (§2.2).
6. **Perk mechanics behind the link** — 72h expiry on the page; no product/discount detail in the SMS body.

---

## 8. Campaign codes (for perks)

Suggested codes to add (e.g. in `campaigns.ts` or your CRM/ESP):

- `WINBACK60` — Member Perk (60d), 1 use
- `COMEBACK90` — Comeback Perk (90d), 1 use  
- `SECONDVISIT` — Second Visit, 1 use (you may already have a variant; align name/code).

**Perk amounts / AOV:** Once you lock in exact amounts (e.g. 200 vs 500 points) or spend thresholds, you can tune the on‑page messaging for AOV without putting those details in the SMS body.

---

*Doc built from strategy + `constants/config`, `app/(tabs)/profile`, `services/campaigns`, `services/lightspeedCustomerLookup`, `customer_analytics_master.csv`.*
