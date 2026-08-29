# Operations / booking reminder scheduler

Automatic Production scheduling for booking reminders is owned by the external
QStash scheduler, not by a GitHub Actions `schedule:` trigger or a Vercel Cron
Job.

## Automatic schedule

QStash calls the consolidated Operations endpoint four times per hour:

```text
GET /api/cron/operations
Authorization: Bearer <CRON_SECRET>
cron: 8,23,38,53 * * * *
```

The Operations route then runs these existing authenticated Production jobs in
sequence:

1. booking reminders;
2. Company Directory Official Facts with `limit=10`;
3. Company Directory sync.

The reminder processor keeps delivery records in the database, so a later run
does not duplicate a notification that has already been claimed.

## GitHub Actions fallback

[booking-reminders.yml](../.github/workflows/booking-reminders.yml) remains as a
manual `workflow_dispatch` recovery path. It must not regain a recurring
`schedule:` trigger while QStash owns automatic Operations scheduling.

The fallback still uses these GitHub repository secrets:

| Secret | Value |
| --- | --- |
| `PROFFERA_REMINDER_CRON_URL` | `https://proffera.se/api/cron/booking-reminders` |
| `PROFFERA_REMINDER_CRON_SECRET` | The exact production Vercel value of `CRON_SECRET` |

`CRON_SECRET` must also exist in Vercel Production. Never commit the secret or
include it in workflow logs.

## Cutover verification

The QStash Operations schedule must remain paused until the scheduler-cutover
PR is merged, the matching Vercel Production deployment is `READY`, and the
official Production health gate succeeds on that exact merge SHA. After the
schedule is resumed, verify the first automatic executions passively rather
than manually dispatching state-changing Production workers just to test them.
