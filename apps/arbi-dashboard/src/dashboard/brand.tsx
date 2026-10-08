import Image from "next/image";
import logo from "../../../../docs/assets/brand/arbi-logo-transparent.png";

/** Consume the committed Garden Focus artwork without recreating its wordmark. */
export function Brand() {
  return <a className="wordmark" href="/"><Image src={logo} alt="ARBI" priority sizes="(max-width: 720px) 240px, 184px" /><span>Garden observatory</span></a>;
}
