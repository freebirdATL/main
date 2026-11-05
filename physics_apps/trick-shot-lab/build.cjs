// Produce one portable, offline HTML file with no external dependencies.
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const script = (name) => `<script>\n${read(name).replace(/<\/script/gi, '<\\/script')}\n</script>`;
let html = read('index.html')
  .replace('  <link rel="stylesheet" href="styles.css">', `  <style>\n${read('styles.css')}\n</style>`)
  .replace('  <script src="physics.js" defer></script>\n  <script src="game.js" defer></script>', '')
  .replace('</body>', `${script('physics.js')}\n${script('game.js')}\n</body>`);
const output = path.resolve(__dirname, '../trickshot.html');
fs.writeFileSync(output, html);
process.stdout.write(`Built ${output}\n`);
