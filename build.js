const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.promises.copyFile(s, d);
    }
  }
}

async function renderFileTo(template, data, outPath) {
  const html = await ejs.renderFile(template, data, { async: false, filename: template });
  await ensureDir(path.dirname(outPath));
  await fs.promises.writeFile(outPath, html, 'utf8');
}

async function main() {
  const root = __dirname;
  const dist = path.join(root, 'dist');
  const templates = path.join(root, 'src', 'templates');
  const assets = path.join(root, 'src', 'assets');
  await ensureDir(dist);
  await copyDir(assets, path.join(dist, 'assets'));
  await renderFileTo(path.join(templates, 'index.ejs'), { title: 'my-ejs-site' }, path.join(dist, 'index.html'));
  console.log('Built to', dist);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

