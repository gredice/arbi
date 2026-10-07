"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Forward links from the earlier single-page site (#/systems/winch) to real routes. */
export function HashRedirect() {
    const router = useRouter();
    useEffect(() => {
        if (location.hash.startsWith("#/")) router.replace(location.hash.slice(1) || "/");
    }, [router]);
    return null;
}
