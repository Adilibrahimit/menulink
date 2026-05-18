---
name: menulink-integration
description: MenuLink platform development and POS integration skill. Use this skill whenever working on the MenuLink project: integrating any POS system (Foodics, Marn, Loyverse, or custom .NET POS like RzRz/Punnelifosys ResApp), onboarding a new restaurant customer, debugging order sync issues, building bridge apps, mapping menu items, or testing end-to-end order flow. Use even when the user does not explicitly mention the project name but mentions restaurant clients, POS integration, kitchen printing, order webhooks, InsertInvoice, or any of the customer names tracked in customers/. This skill maintains accumulated learnings from each customer deployment to prevent repeating known mistakes — always read learnings.md before starting any customer work.
---

# MenuLink Integration Skill

A self-improving playbook for building MenuLink, integrating with POS systems, and onboarding new restaurant customers. **Every customer deployment teaches us something — this skill captures that knowledge so the next deployment is smoother.**

---

## 🚨 ALWAYS DO THIS FIRST

Before starting **any** task related to this skill, read in order:

1. **`learnings.md`** — what we learned from past customers (success patterns, failures to avoid, open questions)
2. **`customers/<active-customer>.md`** — if working on a specific customer, read their file
3. **Relevant reference** — only the one needed for the current task (see "Reference Map" below)

This is not optional. Skipping `learnings.md` means we may repeat a mistake another customer already cost us a day to fix.

---

## 🎯 What This Skill Does

Helps Claude work on three categories of tasks for MenuLink:

| Category | Typical user request |
|----------|---------------------|
| **POS Integration** | "أضف تكامل POS"، "اربط RzRz بـ MenuLink"، "InsertInvoice مش شغّال" |
| **Customer Onboarding** | "عندي مطعم جديد يبغى يشترك"، "اعمل setup لـ [restaurant name]" |
| **Debugging** | "الطلب ما وصل POS"، "الطباعة ما اشتغلت"، "Foodics يرجع error" |

For anything outside these (e.g., generic Next.js dev), do not use this skill — let the main MenuLink context (`CLAUDE.md`, `HANDOFF.md`) drive.

---

## 🧭 Reference Map

Load only the file relevant to the current task:

| Working on... | Read |
|--------------|------|
| RzRz/.NET POS internals, schema, stored procedures | `references/rzrz-deep-dive.md` |
| Onboarding a brand new restaurant client | `references/onboarding-playbook.md` |
| Building XML for InsertInvoice, mapping items | `references/sql-patterns.md` |
| Something is broken — orders not flowing | `references/debugging-playbook.md` |
| Adding a NEW POS integration (not RzRz/Foodics) | `references/adapter-pattern.md` |

---

## 🔄 The Learning Loop (This Is What Makes The Skill Self-Improving)

**At session start:**
- Read `learnings.md`
- If the user names a specific customer/restaurant, read `customers/<that-customer>.md`
- Apply the patterns and avoid the anti-patterns documented there

**During the session:**
- When a new problem is hit that's not in `learnings.md`, note it mentally
- When a fix is found, note the root cause AND the fix
- When the user corrects you ("لا، نحن نسوي كذا"), that's a HIGH-CONFIDENCE learning — always capture it

**At session end (run the reflection — see "Reflection Protocol" below):**
- Append new learnings to `learnings.md` under the right section
- Update or create the customer file in `customers/`
- Be brief — one learning = 2-4 lines

---

## 📋 Reflection Protocol

After completing any non-trivial task in this skill, run this short ritual:

### 1. Ask yourself these 5 questions:

1. **What worked?** Anything that should be repeated next time?
2. **What failed?** Anything that wasted time and should be avoided?
3. **What surprised me?** An undocumented quirk of the customer's setup or POS?
4. **Did the user correct me?** Direct corrections are gold — capture them verbatim.
5. **What do I still not know?** Open questions worth investigating later.

### 2. Format each learning like this:

```markdown
### LRN-YYYY-MM-DD-<short-id> (confidence: high|medium|low)
**Context:** Brief situation
**Learning:** The actual pattern/rule/fact (1-2 sentences)
**Source:** session:<date> | customer:<name>
**Triggers:** keywords that should bring this up later
```

### 3. Choose the right section in `learnings.md`:

- **What worked** → for positive patterns
- **What failed** → for anti-patterns and gotchas
- **Customer quirks** → specific to one restaurant
- **Open questions** → things to investigate later
- **Reflection log** → the timestamped chronological feed

### 4. If a learning is customer-specific, ALSO add it to that customer's file in `customers/`.

### 5. Tell the user what you captured.

Example: "I added 2 learnings to memory: (1) RzRz uses `OnlineCustomerID=0` for walk-in not null, (2) Brother's restaurant requires SectionID=2 for delivery orders."

---

## 🛠️ The Onboarding Workflow (Per New Restaurant)

When a new customer is being added, follow this fixed sequence. Detailed steps are in `references/onboarding-playbook.md` — this is the high-level map:

```
1. Create customers/<restaurant-slug>.md from _template.md
2. Capture: business info, POS type, integration tier (1-5)
3. If POS = Foodics → OAuth flow (Tier 2)
4. If POS = RzRz/.NET → choose: direct DB, Web API, or Bridge App
5. If POS = none → WhatsApp-only (no integration needed)
6. Map menu items (MenuLink ↔ POS IDs)
7. Run test order (1 SAR fake order — see debugging-playbook.md)
8. Document anything weird in the customer file
9. Run reflection — was there a NEW lesson here?
10. Hand off to deployment
```

---

## ⚖️ Key Decisions Already Made (Do Not Re-Litigate)

These are settled. Do not propose alternatives unless the user explicitly asks for reconsideration:

- **Pricing:** 59 SAR/month OR 499 SAR/year. No discounts beyond 20% on first year.
- **Stack:** Next.js 14 + Supabase + Vercel. No custom servers.
- **Target market:** Small-medium restaurants and cafes in Saudi Arabia. NOT global chains.
- **Order channel default:** WhatsApp. Everything else (POS, push, payments) is an upsell.
- **First paying customer:** KO-KO Chicky Licky (direct lead — they approached us, want 2 instances). POS situation TBD, do not assume RzRz.
- **POS integration testbed:** Separate restaurant where user's brother is operations manager. Uses RzRz. This is where the Bridge App will be built and validated before being sold to other RzRz customers.
- **First POS integration target:** RzRz Bridge App (at the testbed restaurant). Foodics second.

---

## ⛔ Hard Rules

- **Never** commit DB passwords or API keys to the codebase. Use environment variables.
- **Never** modify the RzRz .NET POS source code directly. Integrate around it (DB writes, bridge app, or external API).
- **Never** assume — if a piece of info is missing about a customer, read their customer file or ask the user.
- **Never** build a feature before 3 customers ask for it. The exception is RzRz integration since user is building both ends.
- **Always** test order flow end-to-end on brother's restaurant before announcing a feature is "done".

---

## 💬 Communication Style

- The user speaks Arabic (Saudi dialect). Reply in Arabic.
- The user understands English technical terms — use them inline (`schema`, `endpoint`, `webhook`) without translating.
- Be concise. The user is busy and reads quickly.
- When proposing options, give 2-3 max with clear tradeoffs.
- After a long task, run the reflection — but keep it light, not bureaucratic.

---

## 📦 What's In This Skill

```
menulink-integration/
├── SKILL.md                            ← you are here
├── learnings.md                        ← evolving memory · READ FIRST
├── references/
│   ├── rzrz-deep-dive.md               ← RzRz technical reference
│   ├── onboarding-playbook.md          ← step-by-step new customer
│   ├── sql-patterns.md                 ← InsertInvoice XML templates
│   ├── debugging-playbook.md           ← common issues & fixes
│   └── adapter-pattern.md              ← how to add a new POS type
└── customers/
    ├── _template.md                    ← copy for new customers
    ├── koko-chicky-licky.md            ← first paying customer (2 instances requested)
    └── rzrz-restaurant.md              ← RzRz integration testbed (brother is ops manager)
```

---

**Remember:** The whole point of this skill is that we never solve the same problem twice. If you finish a session without updating `learnings.md` when something new was learned, the skill failed at its job.
