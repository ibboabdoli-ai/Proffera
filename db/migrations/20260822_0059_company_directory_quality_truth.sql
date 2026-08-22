-- Align persisted Directory quality with the current source contract.
--
-- F-tax, VAT and employer-registration details are not available from the
-- current official source path. Older scoring treated an active company as if
-- those unavailable details were independently verified and awarded 5 points.
-- Remove only that legacy award, record why the detail is unavailable, and
-- deliberately preserve publication status and profile.updated_at.

begin;

update company_directory_profiles
set quality_score = greatest(0, quality_score - 5),
    quality_reasons = quality_reasons || '["tax_status_unavailable_from_source"]'::jsonb
where is_active is true
  and nullif(trim(f_tax_status), '') is null
  and nullif(trim(vat_status), '') is null
  and nullif(trim(employer_status), '') is null
  and not (quality_reasons ? 'tax_status_unavailable_from_source');

commit;
