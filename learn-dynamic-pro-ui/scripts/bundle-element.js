const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '../dist/lms-copilot-element/browser');
const polyfillsPath = path.join(browserDir, 'polyfills.js');
const mainPath = path.join(browserDir, 'main.js');
const bundlePath = path.join(browserDir, 'lms-copilot.bundle.js');
const publicPath = path.join(__dirname, '../public/lms-copilot.bundle.js');

if (fs.existsSync(mainPath)) {
  let polyfillsContent = '';
  if (fs.existsSync(polyfillsPath)) {
    polyfillsContent = fs.readFileSync(polyfillsPath, 'utf8').trim();
  }
  let mainContent = fs.readFileSync(mainPath, 'utf8').trim();

  // 1. Strip any ES Module export statements to ensure this runs as a classic script
  mainContent = mainContent.replace(/export\s*\{[^}]*\}\s*;?/g, '');
  mainContent = mainContent.replace(/export\s+default\s+[^;]+;?/g, '');

  // 2. Wrap polyfills and main application into separate IIFEs
  // This guarantees complete scope isolation, eliminating top-level naming collisions (e.g. Identifier 'lt' has already been declared)
  const finalBundle = `/**
 * LMS AI Copilot - Standalone Web Component Bundle (IIFE / Self-Contained)
 * Generated automatically. Do not edit directly.
 */
(function() {
  if (typeof window !== 'undefined') {
    // 1. Polyfills / Zone.js isolated scope
    (function() {
      ${polyfillsContent}
    })();

    // 2. LMS Copilot Component isolated scope
    (function() {
      ${mainContent}
    })();
  }
})();
`;

  fs.writeFileSync(bundlePath, finalBundle, 'utf8');
  console.log(`[LMS Copilot] Clean IIFE bundle generated: ${bundlePath} (${(fs.statSync(bundlePath).size / 1024).toFixed(1)} KB)`);

  fs.writeFileSync(publicPath, finalBundle, 'utf8');
  console.log(`[LMS Copilot] Bundle copied to public assets: ${publicPath}`);
} else {
  console.error('[LMS Copilot] main.js not found in output directory');
  process.exit(1);
}
