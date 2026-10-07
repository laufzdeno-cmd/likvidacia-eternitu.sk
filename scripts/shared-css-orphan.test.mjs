import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import postcss from "postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssFiles = [
  "src/styles.css",
  "src/premium-overrides.css",
  "src/final-visual-polish.css",
];
const runtimeRoots = ["app", "src"];
const runtimeExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

const retiredHomepageClasses = [
  "hero-mini-proof",
  "hero-points",
  "hero-proof-flow",
  "included-card",
  "included-grid",
  "photo-proof",
  "photo-proof-bottom",
  "photo-proof-side",
  "photo-proof-top",
  "practice-grid",
  "practice-item",
  "practice-photo-board",
  "practice-photo-main",
  "practice-photo-proof",
  "practice-section",
  "practice-story-card",
  "practice-story-label",
  "practice-story-list",
  "practice-story-picture",
  "practice-story-section",
  "process-document-proof",
  "process-photo",
  "quote-panel-testimonial",
  "quote-panel-testimonial-author",
  "quote-panel-testimonial-content",
  "quote-panel-testimonial-overlay",
  "quote-panel-testimonial-stars",
  "quote-proof-arrow",
  "quote-proof-mark",
  "region-grid-card",
  "why-list",
  "why-proof-strip",
];
const retiredLegacyMediaClasses = [
  "gallery-card",
  "gallery-filter-pill",
  "gallery-grid",
  "gallery-image",
  "public-reviews-list",
  "realization-card",
  "realization-empty",
  "realization-grid",
  "realization-meta",
  "realization-photos",
  "review-author",
  "review-avatar",
  "review-card",
  "review-stars",
  "review-text",
  "reviews-google-link",
  "reviews-grid",
  "reviews-heading",
  "reviews-section",
  "reviews-toggle",
  "testimonial-card",
  "testimonial-empty",
  "testimonial-grid",
  "testimonial-layout",
  "testimonial-layout-form-only",
  "testimonial-section",
  "testimonial-section-form-only",
  "testimonial-stars",
  "testimonial-wide",
];
const retiredExplicitClasses = [
  "final-phone",
  "info-strip",
  "lightbox-close",
  "lightbox-content",
  "meta-item",
  "photo-badge",
  "price-check-icon",
  "proof-step",
  "roof-sky",
  "transport-icon",
];
const retiredClassPrefixes = ["partner-table", "roof-label", "roof-pin", "roof-plane"];
const retiredExactSelectorBranches = new Set(["body.is-menu-open"]);
const retiredSharedClasses = [
  ...retiredHomepageClasses,
  ...retiredLegacyMediaClasses,
  ...retiredExplicitClasses,
];
const retiredSharedClassSet = new Set(retiredSharedClasses);

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(absolutePath);
    return runtimeExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function hasClassToken(text, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`).test(text);
}

function splitSelectorList(selector) {
  const branches = [];
  let current = "";
  let quote = "";
  let squareDepth = 0;
  let roundDepth = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    const escaped = index > 0 && selector[index - 1] === "\\";

    if (quote) {
      current += character;
      if (character === quote && !escaped) quote = "";
      continue;
    }

    if ((character === "\"" || character === "'") && !escaped) {
      quote = character;
      current += character;
      continue;
    }

    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth -= 1;
    if (character === "(") roundDepth += 1;
    if (character === ")") roundDepth -= 1;

    if (character === "," && squareDepth === 0 && roundDepth === 0) {
      branches.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) branches.push(current.trim());
  return branches;
}

function selectorClassNames(selector) {
  return [...selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map(
    (match) => match[1],
  );
}

function isRetiredSharedClass(className) {
  return (
    retiredSharedClassSet.has(className) ||
    retiredClassPrefixes.some(
      (prefix) => className === prefix || className.startsWith(`${prefix}-`),
    )
  );
}

function findUnownedSelectorBranches(selectors, unownedClassSet) {
  return selectors.flatMap(({ file, selector }) =>
    splitSelectorList(selector)
      .filter((branch) =>
        retiredExactSelectorBranches.has(branch) ||
        selectorClassNames(branch).some(
          (className) => isRetiredSharedClass(className) && unownedClassSet.has(className),
        ),
      )
      .map((branch) => ({ file, selector, branch })),
  );
}

test("selector class extraction handles compounds without prefix collisions", () => {
  assert.deepEqual(selectorClassNames(".hero-points"), ["hero-points"]);
  assert.deepEqual(selectorClassNames(".foo.hero-points"), ["foo", "hero-points"]);
  assert.deepEqual(selectorClassNames("main.hero-points"), ["hero-points"]);
  assert.deepEqual(selectorClassNames(".hero-points-extra"), ["hero-points-extra"]);
});

test("mixed selector lists reject an unowned retired branch", () => {
  assert.deepEqual(
    findUnownedSelectorBranches(
      [{ file: "fixture.css", selector: ".live-owner,.hero-points" }],
      new Set(["hero-points"]),
    ),
    [
      {
        file: "fixture.css",
        selector: ".live-owner,.hero-points",
        branch: ".hero-points",
      },
    ],
  );
});

test("retired shared CSS cannot return without a runtime owner", () => {
  const runtimeSource = runtimeRoots
    .flatMap((directory) => walkFiles(path.join(root, directory)))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  const selectors = cssFiles.flatMap((file) => {
    const css = fs.readFileSync(path.join(root, file), "utf8");
    const result = [];
    postcss.parse(css, { from: file }).walkRules((rule) => result.push({ file, selector: rule.selector }));
    return result;
  });

  const selectorClasses = selectors.flatMap(({ selector }) =>
    splitSelectorList(selector).flatMap(selectorClassNames),
  );
  const candidateClasses = [...new Set([...retiredSharedClasses, ...selectorClasses])].filter(
    isRetiredSharedClass,
  );
  const unownedClasses = candidateClasses.filter(
    (className) => !hasClassToken(runtimeSource, className),
  );
  const unownedClassSet = new Set(unownedClasses);
  const violations = findUnownedSelectorBranches(selectors, unownedClassSet).map(
    ({ file, selector, branch }) => `${file}: ${selector} -> ${branch}`,
  );

  assert.deepEqual(
    violations,
    [],
    `Nepoužívané homepage triedy sa vrátili bez runtime vlastníka:\n${violations.join("\n")}`,
  );
});
