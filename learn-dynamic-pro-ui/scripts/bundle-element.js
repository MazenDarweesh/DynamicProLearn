const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '../dist/lms-copilot-element/browser');
const polyfillsPath = path.join(browserDir, 'polyfills.js');
const mainPath = path.join(browserDir, 'main.js');
const bundlePath = path.join(browserDir, 'lms-copilot.bundle.js');

if (fs.existsSync(mainPath)) {
  let content = '';
  if (fs.existsSync(polyfillsPath)) {
    content += fs.readFileSync(polyfillsPath, 'utf8') + '\n';
  }
  content += fs.readFileSync(mainPath, 'utf8');
  fs.writeFileSync(bundlePath, content, 'utf8');
  console.log(`[LMS Copilot] Single bundle generated: ${bundlePath} (${(fs.statSync(bundlePath).size / 1024).toFixed(1)} KB)`);

  // Also copy directly to public/ folder so dev server (port 4200) serves it instantly
  const publicPath = path.join(__dirname, '../public/lms-copilot.bundle.js');
  fs.writeFileSync(publicPath, content, 'utf8');
  console.log(`[LMS Copilot] Bundle copied to public assets: ${publicPath}`);
} else {
  console.error('[LMS Copilot] main.js not found in output directory');
  process.exit(1);
}
