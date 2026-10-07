import { MediaError } from "./contracts";
import { mediaFailure } from "./http";
import type { MediaHttp } from "./http";

let configured: MediaHttp | undefined;
export function configureMedia(runtime: MediaHttp): void { configured = runtime; }
export function mediaRoute(request: Request, params: { siteId: string; action: string; imageId?: string }): Promise<Response> {
  return configured?.handle(request, params) ?? Promise.resolve(mediaFailure(new MediaError("UNAVAILABLE")));
}
