import { MediaError } from "./contracts";
import { mediaFailure } from "./http";
import type { MediaHttp } from "./http";
import { isBranchPreview } from "../deployment";

let configured: MediaHttp | undefined;
export function configureMedia(runtime: MediaHttp): void { configured = runtime; }
export function mediaRoute(request: Request, params: { siteId: string; action: string; imageId?: string }): Promise<Response> {
  return (!isBranchPreview() ? configured?.handle(request, params) : undefined) ?? Promise.resolve(mediaFailure(new MediaError("UNAVAILABLE")));
}
