const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

const input = process.argv[2];
const outputArg = process.argv[3] || 'expo-qr.svg';

if (!input) {
  console.error('Usage: node scripts/generate-expo-qr.js <url> [output-file]');
  process.exit(1);
}

const qr = new QRCode(-1, QRErrorCorrectLevel.M);
qr.addData(input);
qr.make();

const modules = qr.modules;
const moduleCount = qr.getModuleCount();
const quietZone = 4;
const cellSize = 12;
const canvasSize = (moduleCount + quietZone * 2) * cellSize;

let rects = '';

for (let row = 0; row < moduleCount; row += 1) {
  for (let col = 0; col < moduleCount; col += 1) {
    if (!modules[row][col]) {
      continue;
    }

    const x = (col + quietZone) * cellSize;
    const y = (row + quietZone) * cellSize;
    rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1" ry="1" />`;
  }
}

const labelY = canvasSize - 24;
const hrefY = canvasSize - 10;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize + 56}" viewBox="0 0 ${canvasSize} ${canvasSize + 56}" role="img" aria-label="Expo QR code">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="#ffffff" />
  <g fill="#000000">
    ${rects}
  </g>
  <text x="${canvasSize / 2}" y="${labelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111111">Expo Go QR</text>
  <text x="${canvasSize / 2}" y="${hrefY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#444444">${input.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>
`;

const outputPath = path.resolve(outputArg);
fs.writeFileSync(outputPath, svg, 'utf8');
console.log(outputPath);
