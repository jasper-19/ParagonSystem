import { FilterXSS } from "xss";

const articleHtmlFilter = new FilterXSS({
  whiteList: {
    a: ["href", "title", "target", "rel"],
    blockquote: [],
    br: [],
    em: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    i: [],
    li: [],
    ol: [],
    p: [],
    s: [],
    span: [],
    strong: [],
    u: [],
    ul: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
});

export function sanitizeArticleHtml(value: string): string {
  return articleHtmlFilter.process(value);
}
