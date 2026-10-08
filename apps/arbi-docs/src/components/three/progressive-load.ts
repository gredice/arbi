export type LoadProgress = { loaded: number; failed: number; total: number };

/** Publish each ready part independently; a failed download must not hide its neighbours. */
export async function loadParts<T, R>(
    parts: readonly T[],
    load: (part: T) => Promise<R>,
    display: (value: R, part: T) => void,
    progress: (state: LoadProgress) => void,
    active: () => boolean,
) {
    const state: LoadProgress = { loaded: 0, failed: 0, total: parts.length };
    let next = 0;
    progress({ ...state });
    await Promise.all(Array.from({ length: Math.min(4, parts.length) }, async () => {
        while (active() && next < parts.length) {
            const part = parts[next++];
            try {
                const value = await load(part);
                if (!active()) return;
                display(value, part);
                state.loaded++;
            } catch {
                if (!active()) return;
                state.failed++;
            }
            progress({ ...state });
            // Let the browser paint even when every mesh was already cached.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }));
    return state;
}
