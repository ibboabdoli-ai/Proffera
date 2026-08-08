-- Defense-in-depth for workspace-owned relations.
--
-- Production was applied through Neon's parser-safe migration workflow. Keep
-- this canonical source byte-for-byte equivalent in behavior: plain DDL plus
-- NOT VALID / VALIDATE phases, without procedural DO blocks.
--
-- Legacy tables currently store workspace_id as text while newer tables use
-- uuid. This migration only hardens relations whose child/parent workspace_id
-- types already match. RLS is intentionally a separate follow-up phase.

create unique index if not exists customers_id_workspace_unique_idx
  on customers (id, workspace_id);
create unique index if not exists bookings_id_workspace_unique_idx
  on bookings (id, workspace_id);
create unique index if not exists workspace_staff_id_workspace_unique_idx
  on workspace_staff (id, workspace_id);
create unique index if not exists quote_requests_id_workspace_unique_idx
  on workspace_quote_requests (id, workspace_id);
create unique index if not exists service_jobs_id_workspace_unique_idx
  on workspace_service_jobs (id, workspace_id);
create unique index if not exists job_attachments_id_workspace_unique_idx
  on workspace_service_job_attachments (id, workspace_id);
create unique index if not exists review_invitations_id_workspace_unique_idx
  on website_review_invitations (id, workspace_id);

alter table booking_reminder_deliveries
  add constraint booking_reminders_booking_ws_fk
  foreign key (booking_id, workspace_id)
  references bookings (id, workspace_id)
  on delete cascade
  not valid;
alter table booking_reminder_deliveries validate constraint booking_reminders_booking_ws_fk;

alter table bookings
  add constraint bookings_customer_ws_fk
  foreign key (customer_id, workspace_id)
  references customers (id, workspace_id)
  on delete set null (customer_id)
  not valid;
alter table bookings validate constraint bookings_customer_ws_fk;

alter table bookings
  add constraint bookings_staff_ws_fk
  foreign key (staff_id, workspace_id)
  references workspace_staff (id, workspace_id)
  on delete set null (staff_id)
  not valid;
alter table bookings validate constraint bookings_staff_ws_fk;

alter table customer_events
  add constraint customer_events_customer_ws_fk
  foreign key (customer_id, workspace_id)
  references customers (id, workspace_id)
  on delete cascade
  not valid;
alter table customer_events validate constraint customer_events_customer_ws_fk;

alter table customer_events
  add constraint customer_events_booking_ws_fk
  foreign key (booking_id, workspace_id)
  references bookings (id, workspace_id)
  on delete set null (booking_id)
  not valid;
alter table customer_events validate constraint customer_events_booking_ws_fk;

alter table workspace_staff_schedules
  add constraint staff_schedules_staff_ws_fk
  foreign key (staff_id, workspace_id)
  references workspace_staff (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_staff_schedules validate constraint staff_schedules_staff_ws_fk;

alter table workspace_staff_time_off
  add constraint staff_time_off_staff_ws_fk
  foreign key (staff_id, workspace_id)
  references workspace_staff (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_staff_time_off validate constraint staff_time_off_staff_ws_fk;

alter table workspace_quote_offers
  add constraint quote_offers_request_ws_fk
  foreign key (quote_request_id, workspace_id)
  references workspace_quote_requests (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_quote_offers validate constraint quote_offers_request_ws_fk;

alter table workspace_service_jobs
  add constraint service_jobs_quote_request_ws_fk
  foreign key (quote_request_id, workspace_id)
  references workspace_quote_requests (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_jobs validate constraint service_jobs_quote_request_ws_fk;

alter table workspace_service_jobs
  add constraint service_jobs_quote_offer_ws_fk
  foreign key (quote_offer_id, workspace_id)
  references workspace_quote_offers (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_jobs validate constraint service_jobs_quote_offer_ws_fk;

alter table workspace_service_job_attachments
  add constraint job_attachments_job_ws_fk
  foreign key (service_job_id, workspace_id)
  references workspace_service_jobs (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_attachments validate constraint job_attachments_job_ws_fk;

alter table workspace_service_job_events
  add constraint job_events_job_ws_fk
  foreign key (service_job_id, workspace_id)
  references workspace_service_jobs (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_events validate constraint job_events_job_ws_fk;

alter table workspace_service_job_notes
  add constraint job_notes_job_ws_fk
  foreign key (service_job_id, workspace_id)
  references workspace_service_jobs (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_notes validate constraint job_notes_job_ws_fk;

alter table workspace_service_job_payments
  add constraint job_payments_job_ws_fk
  foreign key (service_job_id, workspace_id)
  references workspace_service_jobs (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_payments validate constraint job_payments_job_ws_fk;

alter table workspace_service_job_completion_evidence
  add constraint job_evidence_job_ws_fk
  foreign key (service_job_id, workspace_id)
  references workspace_service_jobs (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_completion_evidence validate constraint job_evidence_job_ws_fk;

alter table workspace_service_job_completion_evidence
  add constraint job_evidence_attachment_ws_fk
  foreign key (attachment_id, workspace_id)
  references workspace_service_job_attachments (id, workspace_id)
  on delete cascade
  not valid;
alter table workspace_service_job_completion_evidence validate constraint job_evidence_attachment_ws_fk;

alter table website_reviews
  add constraint website_reviews_invitation_ws_fk
  foreign key (review_invitation_id, workspace_id)
  references website_review_invitations (id, workspace_id)
  on delete set null (review_invitation_id)
  not valid;
alter table website_reviews validate constraint website_reviews_invitation_ws_fk;
