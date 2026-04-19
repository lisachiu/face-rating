const fs = require('fs');
const path = require('path');

const photosDir = path.join(__dirname, 'public', 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

const gradients = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'], ['#e0c3fc', '#8ec5fc'], ['#f5576c', '#ff6b6b'],
  ['#4facfe', '#667eea'], ['#38f9d7', '#43e97b'], ['#fbc2eb', '#a18cd1'],
  ['#ff9a9e', '#fecfef'], ['#a1c4fd', '#c2e9fb'], ['#d4fc79', '#96e6a1'],
  ['#84fab0', '#8fd3f4'], ['#6a11cb', '#2575fc'], ['#ffecd2', '#fcb69f'],
  ['#ff9a9e', '#fad0c4'], ['#a8edea', '#fed6e3']
];

for (let i = 1; i <= 20; i += 1) {
  const [c1, c2] = gradients[i - 1];
  const num = String(i).padStart(2, '0');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="533" fill="url(#bg)"/>
  <circle cx="200" cy="170" r="55" fill="rgba(255,255,255,0.25)"/>
  <path d="M130,340 C130,280 160,255 200,255 C240,255 270,280 270,340 L270,390 L130,390 Z" fill="rgba(255,255,255,0.25)"/>
  <text x="200" y="470" text-anchor="middle" font-size="32" fill="rgba(255,255,255,0.5)" font-family="sans-serif" font-weight="bold">#${num}</text>
  <text x="200" y="505" text-anchor="middle" font-size="14" fill="rgba(255,255,255,0.3)" font-family="sans-serif">Replace with AI-generated portrait</text>
</svg>`;

  fs.writeFileSync(path.join(photosDir, `${num}.svg`), svg);
}

console.log('Created 20 placeholder images in public/photos/');
console.log('');
console.log('Next steps:');
console.log('  1. If using ChatGPT Plus manually, generate images with chatgpt-prompts-tw-men.md');
console.log('  2. Put the downloaded images into incoming-photos/');
console.log('  3. Run npm.cmd run import:faces');
console.log('  4. If using the API instead, set OPENAI_API_KEY and run npm run generate:faces');
console.log('  Supported formats: .jpg .jpeg .png .webp .svg');
console.log('');
console.log('Start the server with: npm start');
