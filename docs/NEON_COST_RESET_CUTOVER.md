# Neon cost reset / scheduler cutover

Status: **PROPOSED — external QStash changes are not executed by this PR.**

Audit baseline: `main` `4b1e3c1c3cb5ac64703feb57378b64601beecbb0`, verified 2026-09-06.
This document records the accepted read-only diagnosis, the repository-owned scheduler change,
and the revised external cutover contract for Supervisor/Owner authorization.

## Root-cause conclusion

Scheduler-driven PostgreSQL wakeups are a primary cause of the current Neon active-time pattern.
The main Production branch had about 467,672 active seconds in the September billing period at
the audit point, roughly 92% of elapsed wall-clock time. Neon operation history also showed repeated
`start_compute` / `suspend_compute` cycles, so the endpoint is suspending; the problem is repeated
wakeups rather than a permanently running compute.

The current scheduler pattern is sufficient to explain long active stretches. Operations/Marketplace
at `:08/:23/:38/:53`, periodic Production Health at `:08/:38`, dedicated full Directory revalidation
near `:13/:43`, and the repository-owned Directory source probe at `:17` create frequent DB-active
windows. Public/authenticated request volume in the audited window was modest relative to this pattern.

## Why earlier cost changes were insufficient

- PR #719 reduced dedicated Directory revalidation frequency/batch amplification but retained a separate recurring wake window.
- PR #740 cached selected public Directory reads but did not materially change recurring scheduler cadence.
- PR #765 clustered some Operations/Marketplace/health timing while retaining several polling cadences and separate Directory work.
- PR #774 moved recurring Production ownership to QStash while preserving the existing frequencies.
- PR #798 made newly persisted Quote Requests event-driven but deliberately retained the 15-minute Marketplace recovery poll.
- PR #819 removed Operations self-HTTP fan-out but deliberately preserved the same child DB work and scheduler cadence.

The previous work reduced amplification, duplicate ownership, or function invocations. It did not remove
most DB polling frequency. This reset therefore targets **fewer distinct Neon active windows**, while
preserving useful Directory backlog throughput.

## Current Production scheduler map

| Path / trigger | Current cadence | DB/provider behavior | Classification |
| --- | --- | --- | --- |
| `/api/cron/operations` | `8,23,38,53 * * * *` | Runs Booking, Official Facts, Directory Sync | mixed |
| `/api/cron/marketplace-auto-worker` | `8,23,38,53 * * * *` | DB-backed recovery/rematch path | recovery fallback |
| `/api/cron/production-health` | `8,38 * * * *` | DB schema/index/migration proof | health |
| `/api/cron/company-directory-revalidation` | live `13,43 * * * *` | DB + bounded Bolagsverket/SCB work | maintenance/backlog |
| Directory source probe | `17 * * * *` | DB snapshot read + upstream HEAD/probe | maintenance |
| Directory daily safety scan | `31 3 * * *` | DB-backed discovery when needed | maintenance/backlog |
| New Quote Request kick | event-driven | targeted Marketplace worker | user-facing primary |
| Deployment health | push/repository_dispatch/manual | exact-SHA DB proof | release gate |

The handoff mentioned full revalidation at `14,44`; live Production run history showed the effective
cadence at `13,43`, so rollback documentation uses the live value.

## Current Directory backlog evidence

Read-only Production queries at audit time showed:

- 6,532 Directory profiles;
- 1,216 published profiles;
- 26,342 due `pending_verify` discovery queue rows;
- 0 processing queue rows;
- 80 failed queue rows;
- 2 profiles missing Official Facts;
- 1,157 profiles with Official Facts older than seven days.

Recent `automatic_queue` runs processed 5/5 every 15 minutes. Recent full revalidation runs selected
10 profiles and refreshed roughly 9-10 successfully. Therefore this first reset **does not reduce
Directory Sync below four runs/hour** and **does not reduce full revalidation below two runs/hour**.

## Direct-child scheduler authorization boundary

The recurring Operations aggregate already accepts either:

- `CRON_SECRET`; or
- the scoped external `PRODUCTION_SCHEDULER_SECRET`.

Before this PR, the three child routes accepted only `CRON_SECRET`, because Operations translated the
external scheduler credential into the internal child credential when it invoked them in-process.
That made the original direct-QStash cutover invalid: disabling Operations would have caused direct child
requests using the existing scoped scheduler credential to return 401.

This PR updates these three child endpoints:

- `/api/cron/booking-reminders`
- `/api/cron/company-directory-official-facts`
- `/api/cron/company-directory-sync`

to accept `PRODUCTION_SCHEDULER_SECRET` using the same timing-safe bearer comparison pattern as the
existing Operations/Marketplace/Production Health scheduler boundary, while preserving existing
`CRON_SECRET` compatibility for internal/manual recovery.

The external QStash cutover must continue to use the scoped `PRODUCTION_SCHEDULER_SECRET`. Do not expose
or repurpose the broader `CRON_SECRET` merely to make direct scheduling work.

## Bolagsverket concurrency constraint

`waitForBolagsverketRequestSlot` is explicitly **process-local**, not a distributed/global limiter.
For Värdefulla datamängder it spaces requests by 1,050 ms, keeping one runtime instance below the
60 requests/minute policy. Separate Serverless invocations do not share this in-memory queue.

Provider-heavy jobs therefore must not be scheduled on the same minute.

Relevant bounds:

- Directory Sync route `maxDuration = 60s`, automatic queue batch = 5;
- Official Facts route `maxDuration = 60s`, dedicated limit remains 10;
- full Directory revalidation route `maxDuration = 60s`, full-revalidation batch = 10.

The revised nominal schedule deliberately serializes these jobs:

```text
Directory Sync:      08,23,38,53
Official Facts:      10
Full Revalidation:   12,42
```

The minimum nominal provider-heavy start separation is two minutes. Because each relevant endpoint is
bounded to a 60-second function duration, the normal scheduler contract leaves at least one additional
minute between provider-heavy start windows rather than depending on process-local pacing across
Serverless instances.

This is scheduler staggering, not a distributed provider lock. If future evidence shows QStash delay or
provider runtime routinely defeating this bounded separation, a distributed limiter would require a
separate architecture decision; it is not introduced in this PR.

The stagger still clusters work into a small number of Neon active windows: `:08/:10/:12` in the first
half-hour and `:38/:42` in the second half-hour, rather than scattering long-running provider work
throughout the hour.

## SLA conclusions

### Marketplace

New Quote Requests already use event-driven targeted processing. Deduplicated persistence does not create
duplicate event work. The recurring worker is therefore primarily recovery fallback.

Target fallback: retain `8,23,38,53 * * * *`. Production currently configures
`MARKETPLACE_AUTO_WORKER_BATCH_SIZE=1`, so reducing the recurring fallback to hourly would cut burst
recovery capacity from up to four attempted Quote Requests/hour to one. The four recurring runs share the
existing Directory Sync wake windows and therefore do not add separate nominal scheduler slots.

The scheduler interval is not a per-request maximum-wait guarantee. With batch size one, multiple failed
event-driven kicks, prioritized rematches, queue ordering, or an existing processing lease can require
more than one recurring run before a particular request is attempted. Wave 2 remains subject to its
existing six-hour minimum delay. Invitation idempotency, rollout cutoff, Production authorization,
privacy/outreach eligibility, suppression, and matching gates remain unchanged.

### Booking reminders

The reminder query has a strict approximately one-hour eligibility window. Idempotent delivery claims
prevent duplicates after selection, but do not recover a reminder that was never selected.

Therefore hourly scheduling is **not** used. The revised target is twice/hour at minutes `8,38`.
This cuts Booking DB polling from four/hour to two/hour while preserving recovery overlap:

- normal maximum scheduled pickup is about 30 minutes;
- a scheduler delay of less than 30 minutes still remains inside the one-hour eligibility window;
- if one 30-minute scheduler interval is missed, the surrounding successful runs are 60 minutes apart;
  a reminder becoming due after the previous successful run remains less than 60 minutes old at the next run;
- the existing `booking_reminder_deliveries ... on conflict do nothing` claim remains the duplicate-send guard.

The regression contract executes the normal, delayed, and one-missed-interval cases and checks every
minute across the missed interval for a recoverable run.

### Directory Official Facts

This is maintenance/catch-up work. New-company queue processing and full revalidation also refresh Official
Facts. With only two profiles missing facts at audit time, four dedicated facts passes/hour are not
justified independently.

Target: hourly, `limit=10` preserved, staggered to minute 10 so it does not run concurrently with the
minute-8 Directory Sync worker.

### Directory Sync

This is active backlog processing. Current runs process five rows each run. Cutting its cadence now would
reduce useful throughput of roughly 20 rows/hour.

Target: preserve four runs/hour at `8,23,38,53` and move it from the Operations aggregate to direct
scheduling with `PRODUCTION_SCHEDULER_SECRET`.

### Dedicated full revalidation

Current runs are productive, so two/hour throughput is preserved. It is staggered away from both Directory
Sync and Official Facts rather than placed on the same minute.

Target: `12,42 * * * *`.

This still pulls the current `13,43` work closer to the main Neon windows without creating concurrent
Bolagsverket-heavy Serverless invocations.

### Production Health

Periodic Production Health opens PostgreSQL to prove required columns, indexes, and migration state.
The exact-SHA post-deployment/repository-dispatch/manual paths already provide the required release gate.
Periodic background polling is therefore reduced to every six hours.

Target: `8 */6 * * *`. Exact-SHA and manual verification remain unchanged and still require DB proof.

## Repository-owned change in this PR

Company Directory source probing changes from hourly to every six hours and is nominally aligned with the
minute-8 cluster:

```text
CURRENT:  17 * * * *
PROPOSED: 8 */6 * * *
```

The daily full discovery safety scan remains exactly:

```text
31 3 * * *
```

GitHub scheduled workflows are best-effort and can be delayed, so the lower frequency is the primary cost
control. Minute alignment is a best-effort clustering benefit, not a distributed serialization guarantee.

# EXTERNAL QSTASH CUTOVER PLAN — NOT EXECUTED

The cutover must preserve single recurring ownership. No QStash mutation is part of this PR.
Do not change retry counts, timeouts, or provider configuration. Direct child schedules must use the
existing scoped `PRODUCTION_SCHEDULER_SECRET`, not `CRON_SECRET`.

## 1. Operations aggregate

```text
CURRENT:
GET /api/cron/operations
cron: 8,23,38,53 * * * *

PROPOSED:
Remove the recurring Operations aggregate schedule only after the three direct child schedules below
are ready for the same cutover.

WHY:
The three child jobs have different SLAs. Directory Sync needs the current 15-minute backlog throughput;
Booking needs retry overlap but only twice/hour; Official Facts is maintenance and can run hourly.

ROLLBACK:
Remove the three direct child recurring schedules and restore Operations exactly to
8,23,38,53 * * * * with the previous scoped scheduler credential/retry/timeout settings.
```

## 2. Directory Sync direct schedule

```text
CURRENT:
Owned indirectly by Operations at 8,23,38,53 * * * *

PROPOSED:
GET /api/cron/company-directory-sync
cron: 8,23,38,53 * * * *
Authorization: Bearer <PRODUCTION_SCHEDULER_SECRET>

WHY:
Preserve current useful queue throughput while allowing the other Operations children to use slower
cadences. Minute 8/23/38/53 remains the provider-heavy base window.

RECOVERY LATENCY:
Maximum nominal backlog pickup latency remains 15 minutes.

ROLLBACK:
Remove this direct schedule before restoring the Operations aggregate.
```

## 3. Booking Reminders direct schedule

```text
CURRENT:
Owned indirectly by Operations at 8,23,38,53 * * * *

PROPOSED:
GET /api/cron/booking-reminders
cron: 8,38 * * * *
Authorization: Bearer <PRODUCTION_SCHEDULER_SECRET>

WHY:
The strict one-hour eligibility window needs overlap/retry slack. Twice-hourly scheduling cuts polling
in half without changing reminder-query semantics.

RECOVERY LATENCY:
Normal nominal pickup <=30 minutes. One missed 30-minute interval remains recoverable by the surrounding
runs under the existing one-hour eligibility window.

ROLLBACK:
Remove this direct schedule before restoring the Operations aggregate.
```

## 4. Directory Official Facts direct schedule

```text
CURRENT:
Owned indirectly by Operations at 8,23,38,53 * * * * with limit=10

PROPOSED:
GET /api/cron/company-directory-official-facts?limit=10
cron: 10 * * * *
Authorization: Bearer <PRODUCTION_SCHEDULER_SECRET>

WHY:
Maintenance/catch-up work can run hourly. Minute 10 keeps it two minutes after the minute-8 Directory
Sync invocation instead of starting both Bolagsverket-backed paths concurrently.

RECOVERY LATENCY:
Maximum nominal missing-facts catch-up latency 60 minutes for this dedicated path.

ROLLBACK:
Remove this direct schedule before restoring the Operations aggregate.
```

## 5. Marketplace Auto Worker

```text
CURRENT:
GET /api/cron/marketplace-auto-worker
cron: 8,23,38,53 * * * *

PROPOSED:
cron: 8,23,38,53 * * * *

WHY:
Genuinely new Quote Requests already trigger targeted event-driven work, so the recurring path remains a
recovery/rematch fallback. Production batch size is one; keeping four runs/hour preserves the current
burst-recovery capacity. The cadence shares the Directory Sync wake windows and adds no new nominal slots.

RECOVERY CAPACITY / WAITING TIME:
The 15-minute cron interval provides up to four recurring recovery opportunities per hour. It is not a
promise that every queued request will be recovered within 15, 60, or 70 minutes. Per-request waiting time
depends on queue ordering, prior failed event-driven work, rematch priority/leases, and the batch-size-one
limit. Wave 2 remains no earlier than six hours.

ROLLBACK:
No Marketplace cadence change is part of this cutover. Keep or restore exactly `8,23,38,53 * * * *` with
its existing batch-size-one Production configuration.
```

## 6. Production Health periodic schedule

```text
CURRENT:
GET /api/cron/production-health
cron: 8,38 * * * *

PROPOSED:
cron: 8 */6 * * *

WHY:
Exact-SHA post-deployment and manual/repository-dispatch health checks remain DB-backed and fail closed.
Twice-hourly background schema polling is not required for the release gate.

RECOVERY LATENCY:
Periodic visibility up to six hours; deployments still get immediate exact-SHA verification.

ROLLBACK:
Restore exactly 8,38 * * * *.
```

## 7. Dedicated full Company Directory revalidation

```text
CURRENT:
GET /api/cron/company-directory-revalidation
live runtime: 13,43 * * * *

PROPOSED:
cron: 12,42 * * * *

WHY:
Current runs are useful and two/hour throughput is preserved. Minute 12 follows the minute-10 Official
Facts path, while minute 42 follows the minute-38 Directory Sync path. Provider-heavy jobs are not assigned
to the same minute, and each relevant route has a 60-second maximum duration.

RECOVERY LATENCY:
Unchanged: maximum nominal 30 minutes.

ROLLBACK:
Restore the verified pre-cutover live schedule 13,43 * * * *.
```

## Final proposed scheduler map

```text
Directory Sync:             8,23,38,53 * * * *
Booking Reminders:          8,38 * * * *
Marketplace recovery:       8,23,38,53 * * * *
Directory Official Facts:   10 * * * *
Full Directory revalidation:12,42 * * * *
Periodic Production Health: 8 */6 * * *
Directory source probe:     8 */6 * * *   (repository-owned)
Directory daily safety:     31 3 * * *     (repository-owned, unchanged)
```

Provider-heavy jobs assigned to the same minute: **NO**.

## Cutover order

1. Confirm the cost-reset PR is merged and the exact merge SHA is healthy in Production.
2. Snapshot all current QStash schedule IDs, URLs, cron expressions, retry counts, timeouts, and auth headers.
3. Confirm the three direct child routes on the deployed exact SHA accept `PRODUCTION_SCHEDULER_SECRET` and still accept `CRON_SECRET` through regression/CI evidence; do not manually dispatch Production state-changing workers for proof.
4. Prepare the three direct child schedules with the scoped `PRODUCTION_SCHEDULER_SECRET`.
5. Disable/remove recurring Operations ownership and activate direct Directory Sync, Booking, and Official Facts in the smallest possible cutover interval so no duplicate recurring owner remains.
6. Keep Marketplace recovery unchanged at `8,23,38,53 * * * *`; change only periodic Production Health and full Directory revalidation to their proposed crons.
7. Verify exactly one recurring owner for each job and no GitHub + QStash double scheduling.
8. Verify the first natural runs passively. Do not manually invoke Production email/SMS/outreach workers merely to test cadence.

If any step cannot preserve single ownership or scoped authorization, rollback immediately before continuing.

## Measurement plan

Capture T0 immediately before the authorized external cutover:

- Neon `active_time` / active seconds;
- compute time;
- CU-hours;
- compute start/suspend operations;
- Vercel Production request counts for each cron path;
- Directory queue depth and per-run throughput;
- Marketplace recovery errors/deadline results;
- reminder failures/pending delivery counts.

Then compare at:

- **+2h** — verify cadence, single ownership, direct-child auth, no reminder/Marketplace/Directory regression;
- **+6h** — first periodic-health interval and preliminary active-time slope;
- **+24h** — primary success window; target Active Time below 40% unless real traffic objectively explains more;
- **+48h** — confirm stable trend and queue/recovery behavior.

Do not start another cost optimization during the 48-hour measurement window unless there is an incident.

## Mutation statement

- QStash Production mutation performed by this PR: **NO**
- Neon configuration mutation performed by this PR: **NO**
- Production DB mutation performed by this PR: **NO**
- Vercel Production environment mutation performed by this PR: **NO**