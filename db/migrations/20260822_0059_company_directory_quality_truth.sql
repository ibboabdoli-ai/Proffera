-- Align persisted Directory quality with the current source contract.
--
-- F-tax, VAT and employer-registration details are not available from the
-- current official source path. Older scoring treated an active company as if
-- those unavailable details were independently verified and awarded 5 points.
-- Remove only that legacy award and record why the detail is unavailable.
-- If the correction would move an already-published profile below the public
-- quality guard, fail closed to Review instead of violating the constraint.
-- Preserve profile.updated_at so this repair does not masquerade as source data.

begin;

update company_directory_profiles
set publication_status = case
      when publication_status = 'published' and quality_score < 85 then 'review'
      else publication_status
    end,
    quality_score = greatest(0, quality_score - 5),
    quality_reasons = quality_reasons || '["tax_status_unavailable_from_source"]'::jsonb
where is_active is true
  and nullif(trim(f_tax_status), '') is null
  and nullif(trim(vat_status), '') is null
  and nullif(trim(employer_status), '') is null
  and not (quality_reasons ? 'tax_status_unavailable_from_source');

commit;
