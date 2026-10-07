// Render repository Markdown at build time, rewriting repository-relative links to site
// routes (documents, BOM items) or to GitHub for files the site does not publish.
import { Marked, type Tokens } from "marked";
import { links } from "./format";
import { data, docHref } from "./site";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function resolve(from: string, href: string) {
    const out = from.split("/").slice(0, -1);
    for (const seg of href.split("/")) {
        if (seg === "..") out.pop();
        else if (seg !== "." && seg !== "") out.push(seg);
    }
    return out.join("/");
}

export function siteLink(from: string, href: string): { href: string; external: boolean } {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href, external: true };
    const [file, fragment] = href.split("#");
    if (!file) return { href: `#${fragment ?? ""}`, external: false };
    const target = resolve(from, file);
    const hash = fragment ? `#${fragment}` : "";
    const bom = target.match(/^bom\/generated\/parts\/(.+)\.md$/);
    if (bom) return { href: `/bom/${bom[1]}`, external: false };
    const doc = docHref(target);
    if (doc) return { href: doc + hash, external: false };
    return { href: links.source(target) + hash, external: true };
}

export function renderMarkdown(repoPath: string): string {
    const text = data().docTexts[repoPath] ?? `# Not found\n\n${repoPath}`;
    const marked = new Marked({
        renderer: {
            link(token: Tokens.Link) {
                const { href, external } = siteLink(repoPath, token.href);
                const inner = this.parser.parseInline(token.tokens);
                return `<a href="${escape(href)}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${inner}</a>`;
            },
            image(token: Tokens.Image) {
                const src = /^[a-z]+:/i.test(token.href) ? token.href : `/data/${resolve(repoPath, token.href)}`;
                return `<img src="${escape(src)}" alt="${escape(token.text)}" loading="lazy">`;
            },
            html(token: Tokens.HTML | Tokens.Tag) {
                return token.text.replace(/\bsrc="([^"]+)"/g, (whole, src: string) =>
                    /^[a-z]+:|^\//i.test(src) ? whole : `src="/data/${resolve(repoPath, src)}"`,
                );
            },
            code(token: Tokens.Code) {
                return `<pre${token.lang === "mermaid" ? ' class="mermaid-src"' : ""}><code>${escape(token.text)}</code></pre>`;
            },
        },
    });
    return marked.parse(text, { async: false });
}
