import { EnrollmentError } from "./contracts";
import { failure } from "./http";
import type { EnrollmentHttp } from "./http";
import { isBranchPreview } from "../deployment";

/** Explicit server composition seam. Missing trusted identity/storage configuration always denies. */
let configured: EnrollmentHttp | undefined;
export function configureEnrollment(runtime: EnrollmentHttp): void { configured = runtime; }
export function enrollmentRoute(request: Request, params: { siteId: string; action: string }): Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request, params) : undefined) ?? Promise.resolve(failure(new EnrollmentError("UNAVAILABLE")));
}
