# CF Tracker — Problem Statement

**v1.0 — Locked May 2026**

---

## Overview

CF Tracker is a personalized coaching platform for Codeforces users targeting reliable performance at Div 2 A and B. It analyzes a user's submission history, computes skill gaps against a benchmarked peer population, and prescribes a daily problem plan calibrated to close those gaps.

Unlike CP analytics dashboards that surface what a user has already done, CF Tracker is a **closed-loop coaching system**: it diagnoses, prescribes, re-measures via real contest outcomes, and adjusts. Contest failures feed back into the prescription as an independent signal, so a user cannot grind their way out of a topic through practice volume alone — mastery requires contest evidence.

---

## Target user

Self-studying competitive programming learners, currently in the **800–1300 rating range**, who want to reliably solve Div 2 A and B in real contests.

The pain point this addresses: scattered practice across topics without a coherent prescription. Most users either grind random problems or follow generic CP roadmaps disconnected from their actual weakness profile.

---

## Success metric

A user is considered to be "performing reliably" when, in their **last 6 real Div 2 contests**:

- They solved A in under **15 minutes** in at least 4 of 6
- They solved B in under **40 minutes** in at least 4 of 6

Both conditions must independently hold. The metric is evaluated as a Boolean: `aReliableCount >= 4 AND bReliableCount >= 4`. It is **not** a single combined count of "contests where both A and B were reliable."

**Why this metric:**
- A and B are the gateway problems for rating progression up to ~1400.
- Time-bounded thresholds (not just "solved") capture mastery vs. lucky finishes.
- The 4/6 threshold tolerates one bad contest and one off-day without invalidating progress.
- Virtual contests do **not** count toward this metric — only real CONTESTANT participations.

---

## Population benchmark methodology

Skill gaps are measured relative to a peer cohort whose members already meet the success criteria the target user is working toward.

### Cohort filters (primary)

| Filter | Value |
|---|---|
| Country | India |
| Rating | 1300–1500 |
| Contest count | ≥ 30 |
| Total solves | ≥ 500 |
| Last contest within | 180 days |

### Cohort size and aggregation

- **N ≥ 20** required for primary cohort.
- Per (topic, rating bucket) target count = **median (p50)** of cohort users' solves in that bucket.
- Median, not mean — robust to outliers (a 5,000-problem user barely shifts it).

### Fallback order (if N < 20 with primary filters)

1. IN, 1300–1500 (primary)
2. IN, 1300–1700 (expand rating upward)
3. Global, 1300–1500
4. Global, 1300–1700
5. If still N < 15: **hold the previous benchmark version**, do not refresh below floor

**Why these constraints:**
- Recency filter (180 days) excludes inactive accounts reflecting older meta.
- Contest-count and solves floors exclude practice-only users without contest signal.
- Indian-only primary filter aligns the cohort to the target user's contest pool and time zone.

---

## The gap function (v1)

For each (topic, rating bucket) pair, three signals are combined:

```
base_gap     = 1 - (solves / target_count)              clamped to [0, 1]
penalty      = β × (contest_fails / contest_opportunities)
final_gap    = clamp(base_gap + penalty, 0, 1)
```

With **β = 0.4**.

### Definitions

- `solves` = AC submissions in (topic, bucket) for this user
- `target_count` = cohort median of solves in (topic, bucket)
- `contest_fails` = real CONTESTANT non-AC submissions in (topic, bucket)
- `contest_opportunities` = contests where this (topic, bucket) appeared as A or B and the user participated
- `penalty = 0` when `contest_opportunities = 0` (divide-by-zero handled)

### Why bucketed

Aggregating across rating buckets allows easy-bucket over-solves to mathematically cancel hard-bucket under-solves, hiding real weaknesses. Bucketing by (topic, rating range) prevents this cancellation.

### Why additive (Option B), not multiplicative

Contest performance is treated as a **separate, independent signal**. A user with 100% practice completion who still fails this topic in contests retains a non-zero gap via the penalty. This encodes the design thesis: **practice volume ≠ mastery**.

### Why β = 0.4

At maximum failure rate, contest signal contributes 0.4 to the gap — substantial but not overriding. β = 1.0 would let contest signal dominate; β = 0.1 would barely register. 0.4 is a defensible midpoint pending real tuning data.

### Multi-tag attribution rule

Codeforces problems carry multiple tags (e.g., `["dp", "greedy", "graphs"]`). On every relevant submission, **all matching (topic, bucket) score rows are incremented** — the all-tags rule.

The same all-tags rule is applied when computing cohort medians, so practice-volume comparisons remain unbiased. Slight count inflation is acceptable and consistent across both sides of the comparison.

---

## Validation methodology

Whether the gap function actually drives improvement is established **correlationally, not causally**:

- **Per-user pre-post comparison:** For each user, solve rate on previously-flagged-weak topics is measured for the 30 days before tool adoption (baseline) and the 30 days after.
- **The user is their own control**, which removes confounders like baseline ability and motivation but does not control for regression to the mean or external study.
- **Minimum N constraint:** A topic-bucket comparison is only valid with at least **10 problems attempted** in that bucket. Smaller samples are excluded from validation reporting.
- **Correlational, not causal.** This is stated explicitly in interview defense; the methodology is honest about what it does and does not prove.

---

## Out of scope (v1)

Explicitly **not** built in v1:

- ML-based recommendation models (the gap function is rule-based, deliberately)
- Live in-contest coaching (analysis is post-contest)
- Solutions or hints for problems (links out to Codeforces only)
- Social features (no leaderboards, friend lists, sharing)
- Multi-platform support (Codeforces only; not LeetCode, AtCoder, etc.)
- Div 1, Div 3, or Educational rounds in success metric (Div 2 real contests only)

These are deliberate constraints to keep v1 scope buildable and the success metric measurable.

---

## Key invariants

The following are non-negotiable design principles. Any future change that violates them requires re-deriving the success metric.

1. **Real contest performance overrides practice volume.** No amount of practice closes a gap if contest fails persist.
2. **Cohort comparison must be defensible.** Filters, fallbacks, and version history are stored for audit.
3. **Validation honesty.** Correlational claims only. No causal language unless an RCT is run.
4. **Virtuals don't count toward the success metric.** Only real CONTESTANT participations.
5. **Time-bounded reliability, not just solved.** A solved in 14 minutes is reliable; A solved in 22 minutes is not.
