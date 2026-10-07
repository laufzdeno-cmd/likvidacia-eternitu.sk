import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stabilityCss = readFileSync('src/public-header-stability.css', 'utf8');
const homeCss = readFileSync('public/assets/home-below-fold.css', 'utf8');
const careerCss = readFileSync('app/kariera/career.module.css', 'utf8');

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('known public contrast regressions keep explicit WCAG-AA-safe foregrounds', () => {
  assert.match(homeCss, /\.process-list\.process-stepper p\s*\{\s*color:\s*#52657b\s*!important;/);
  assert.match(
    stabilityCss,
    /main\.seo-page \.seo-calculator \.price-materials button\.is-active\s*\{[^}]*background:\s*#b33118\s*!important;[^}]*color:\s*#ffffff\s*!important;/,
  );
  assert.ok(contrastRatio('ffffff', 'b33118') >= 4.5, 'active material must meet WCAG AA contrast');
  assert.ok(contrastRatio('ffffff', '84200e') >= 4.5, 'hovered material must meet WCAG AA contrast');
  assert.ok(contrastRatio('52657b', 'ffffff') >= 4.5, 'muted supporting copy must meet WCAG AA contrast');
  assert.match(careerCss, /\.formHelp\s*\{[^}]*color:\s*#52657b;/);
});
