const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'www');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
['style.css', 'game.js'].forEach(function (f) {
  const src = path.join(__dirname, f);
  const dest = path.join(dir, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
});
