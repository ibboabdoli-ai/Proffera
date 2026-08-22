begin;

-- When a Guest Quote invitation is sent to the exact conflict-free SCB business
-- email already stored for the selected Directory profile, record that the
-- contact came from an official registry source instead of leaving the row
-- labelled as a manually supplied address. This changes provenance only; all
-- existing eligibility, suppression and 3+2 invitation guards still apply.
--
-- Manual rollback: deploy application code that no longer depends on this
-- classifier first, then drop marketplace_quote_invitation_contact_basis_trigger
-- and classify_marketplace_invitation_contact_basis(). Existing contact_basis
-- values are historical provenance and are intentionally not rewritten back.
create or replace function classify_marketplace_invitation_contact_basis()
returns trigger
language plpgsql
as $$
declare
  allow_automatic_promotion boolean := false;
begin
  if new.contact_basis = 'manual_business_contact' then
    if tg_op = 'INSERT' then
      allow_automatic_promotion := true;
    elsif tg_op = 'UPDATE' and old.contact_basis is not distinct from new.contact_basis then
      allow_automatic_promotion := true;
    end if;
  end if;

  if allow_automatic_promotion
     and exists (
       select 1
       from company_directory_scb_enrichment scb
       where scb.profile_id = new.profile_id
         and nullif(lower(btrim(scb.email)), '') = lower(btrim(new.recipient_email))
         and jsonb_typeof(scb.conflicts) = 'array'
         and jsonb_array_length(scb.conflicts) = 0
     ) then
    new.contact_basis := 'official_business_register';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_contact_basis_trigger
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_contact_basis_trigger
before insert or update of recipient_email, profile_id, contact_basis
on marketplace_quote_invitations
for each row
execute function classify_marketplace_invitation_contact_basis();

commit;
