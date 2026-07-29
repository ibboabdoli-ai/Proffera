# Booking reminder scheduler

Booking reminders are processed by a GitHub Actions schedule, not a Vercel
Cron Job. This keeps Vercel Hobby deployments valid and does not create a
Vercel deployment for every scheduled run.

## Schedule

The workflow [booking-reminders.yml](../.github/workflows/booking-reminders.yml)
runs at minutes 7, 22, 37 and 52 of every hour. It prevents overlapping runs
and calls the authenticated production endpoint:

```text
GET /api/cron/booking-reminders
Authorization: Bearer <CRON_SECRET>
```

The reminder processor keeps delivery records in the database, so a later run
does not duplicate a notification that has already been claimed.

## One-time production configuration

Set these two GitHub repository secrets in
`Settings → Secrets and variables → Actions`:

| Secret | Value |
| --- | --- |
| `PROFFERA_REMINDER_CRON_URL` | `https://proffera.se/api/cron/booking-reminders` |
| `PROFFERA_REMINDER_CRON_SECRET` | The exact production Vercel value of `CRON_SECRET` |

`CRON_SECRET` must also exist in Vercel Production. Use a new high-entropy
value if it has not been configured yet, then place that same value in the
GitHub secret. Never commit either value to the repository or include it in a
workflow log.

## Verification

After both GitHub secrets are set, run the **Booking reminders** workflow once
from its Actions page. A successful run returns the API response and confirms
that GitHub Actions can securely reach the production endpoint. Scheduled runs
then continue automatically without Vercel deployments.
