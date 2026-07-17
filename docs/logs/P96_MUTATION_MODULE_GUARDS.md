# P96 — Mutation module guards

Date: 2026-07-17

## Outcome

Sensitive dashboard mutations now enforce the workspace module flag inside the server action.

- Creating customers requires Customer CRM access.
- Adding customer notes requires Customer CRM access.
- Creating bookings requires Online Booking access.
- Changing booking status requires Online Booking access.

Role and membership checks remain required. This closes the path where a locked page action could otherwise be invoked directly. No migration was required and the AI assistant page was not changed.
