const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'photos', 'raw');
const COUNT = 40; // 多下載一些，方便挑選
const DELAY_MS = 1500; // 每次間隔避免被封

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res2 => {
          res2.pipe(file);
          file.on('finish', () => file.close(resolve));
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  console.log(`📸 準備從 thispersondoesnotexist.com 下載 ${COUNT} 張 AI 人臉...`);
  console.log(`📁 儲存至: ${OUT_DIR}\n`);

  let success = 0;
  for (let i = 1; i <= COUNT; i++) {
    const filename = `face_${String(i).padStart(2, '0')}.jpg`;
    const dest = path.join(OUT_DIR, filename);

    try {
      // 加上 random query string 確保每次拿到不同的臉
      const url = `https://thispersondoesnotexist.com/?_=${Date.now()}_${i}`;
      await download(url, dest);

      const size = fs.statSync(dest).size;
      if (size < 5000) {
        console.log(`  ⚠️  ${filename} 檔案太小 (${size} bytes)，可能下載失敗`);
        fs.unlinkSync(dest);
      } else {
        success++;
        console.log(`  ✅ ${filename} (${(size / 1024).toFixed(0)} KB) [${success}/${COUNT}]`);
      }
    } catch (err) {
      console.log(`  ❌ ${filename} 失敗: ${err.message}`);
    }

    // 等待避免被擋
    if (i < COUNT) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n🎉 完成！成功下載 ${success} 張`);
  console.log(`\n📝 下一步：`);
  console.log(`   1. 打開 ${OUT_DIR} 瀏覽照片`);
  console.log(`   2. 挑選 20 張看起來像台灣男性的照片`);
  console.log(`   3. 將選好的照片重新命名為 01.jpg ~ 20.jpg`);
  console.log(`   4. 移到 public/photos/ 目錄（刪掉原本的 .svg 佔位圖）`);
  console.log(`\n   或直接執行: node pick.js`);
}

main();
