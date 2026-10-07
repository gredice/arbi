import Link from "next/link";
import { Crumb } from "@/components/Crumb";

export default function NotFound() {
    return (
        <>
            <Crumb left="Not found" />
            <div className="px-4 py-20 sm:px-6">
                <h1 className="cond text-[88px] leading-[0.85]">Not found</h1>
                <p className="mt-6 text-[15px]">This page is not part of the current repository build.</p>
                <Link href="/" className="key mt-8">
                    Back to the cover →
                </Link>
            </div>
        </>
    );
}
