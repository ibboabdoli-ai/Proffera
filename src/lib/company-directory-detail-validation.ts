import { rememberCompleteBolagsverketOrganizationRecord } from "./company-directory-detail-cache";
import {
  collectBolagsverketApiErrors,
  formatBolagsverketApiErrors,
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
    throw new Error(
      `Bolagsverket response contains incomplete data: ${formatBolagsverketApiErrors(errors)}`,
    );
  }

  const record = resolveBolagsverketOrganizationRecord(payload, requestedOrganizationNumber);
  rememberCompleteBolagsverketOrganizationRecord(requestedOrganizationNumber, record);
  return record;
}
