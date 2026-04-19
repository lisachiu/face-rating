// 互動式挑選工具：從 raw 資料夾挑出照片並自動重命名
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RAW_DIR = path.join(__dirname, 'public', 'photos', 'raw');
const OUT_DIR = path.join(__dirname, 'public', 'photos');
const TARGET = 20;

if (!fs.existsSync(RAW_DIR)) {
  console.log('❌ raw 資料夾不存在，請先執行: node download-faces.js');
  process.exit(1);
}

const files = fs.readdirSync(RAW_DIR).filter(f => /\.jpg$/i.test(f)).sort();
if (files.length === 0) {
  console.log('❌ raw 資料夾中沒有 .jpg 檔案');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log(`\n📂 找到 ${files.length} 張下載的照片`);
  console.log(`🎯 需要挑選 ${TARGET} 張\n`);
  console.log('操作方式：');
  console.log('  y / Enter = 選取');
  console.log('  n / 其他   = 跳過');
  console.log('  q          = 結束\n');

  // Remove old SVG placeholders
  fs.readdirSync(OUT_DIR).filter(f => /\.svg$/i.test(f)).forEach(f => {
    fs.unlinkSync(path.join(OUT_DIR, f));
  });

  const picked = [];

  for (const file of files) {
    if (picked.length >= TARGET) break;

    const src = path.join(RAW_DIR, file);
    console.log(`--- ${file} (${picked.length}/${TARGET} 已選) ---`);

    // 在預設圖片瀏覽器中開啟
    const { exec } = require('child_process');
    exec(`start "" "${src}"`);

    const ans = await ask('選取這張? (y/n/q): ');

    if (ans.toLowerCase() === 'q') break;
    if (ans.toLowerCase() === 'n') continue;

    // 選取 → 複製並重命名
    const num = String(picked.length + 1).padStart(2, '0');
    const dest = path.join(OUT_DIR, `${num}.jpg`);
    fs.copyFileSync(src, dest);
    picked.push(file);
    console.log(`  ✅ → ${num}.jpg\n`);
  }

  console.log(`\n🎉 已挑選 ${picked.length} 張照片到 public/photos/`);

  if (picked.length < TARGET) {
    console.log(`⚠️  只選了 ${picked.length} 張（目標 ${TARGET} 張），可以再下載更多或降低標準`);
  }

  rl.close();
}

main();
