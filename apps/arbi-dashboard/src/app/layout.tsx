import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "ARBI · Garden observatory", description: "Protected site status and explicit simulation context." };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
