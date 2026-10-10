import type { ReactNode } from "react";
import "./globals.css";
import { isBranchPreview } from "../deployment";
export const metadata = { title: "ARBI · Garden observatory", description: "Protected site status and explicit simulation context." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{isBranchPreview() && <div className="environment" role="status"><strong>NONPRODUCTION PREVIEW</strong><span>Device connections, sign-in and installation requests are unavailable.</span></div>}{children}</body></html>;
}
