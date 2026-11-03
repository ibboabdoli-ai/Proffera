import { rememberCompleteBolagsverketOrganizationRecord } from "./company-directory-detail-cache";
import {
  BolagsverketOrganizationNotFoundError,
  collectBolagsverketApiErrors,
  formatBolagsverketApiErrors,
  isDeterministicBolagsverketOrganizationNotFound,
  resolveBolagsverketOrganizationRecord,
} from "./company-directory-official-facts-errors";

/**
 * Validate a complete Bolagsverket detail response before consuming any dataset.
 * HTTP 200 is not sufficient: nested `fel` values mean the response is partial.
 */
export function resolveCompleteBolagsverketOrganizationRecord(
  payload: unknown,
  requestedOrganizationNumber: string,
) {
  const errors = collectBolagsverketApiErrors(payload);
  if (errors.length > 0) {
    const message = `Bolagsverket response contains incomplete data: ${formatBolagsverketApiErrors(errors)}`;
    if (isDeterministicBolagsverketOrganizationNotFound(errors)) {
      // A different organization's error must never delay the requested company.
      // Fail closed on root-level errors, ambiguous identities and mixed records.
      let requestedRecord: ReturnType<typeof resolveBolagsverketOrganizationRecord> | null = null;
      try {
        requestedRecord = resolveBolagsverketOrganizationRecord(payload, requestedOrganizationNumber);
      } catch {
        // Keep the ordinary incomplete-data response for ambiguous or absent identities.
      }
      if (requestedRecord) {
        const requestedErrors = collectBolagsverketApiErrors(requestedRecord);
        if (
          requestedErrors.length === errors.length
          && isDeterministicBolagsverketOrganizationNotFound(requestedErrors)
        ) {
          throw new BolagsverketOrganizationNotFoundError(message);
        }
      }
    }
    throw new Error(message);
  }

  const record = resolveBolagsverketOrganizationRecord(payload, requestedOrganizationNumber);
  rememberCompleteBolagsverketOrganizationRecord(requestedOrganizationNumber, record);
  return record;
}
