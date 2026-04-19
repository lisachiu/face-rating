const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const targetDir = path.join(projectRoot, 'public', 'photos');
const sourceDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, 'incoming-photos');
const overwrite = process.env.OVERWRITE === '1';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

if (!fs.existsSync(sourceDir)) {
  console.error(`Source folder not found: ${sourceDir}`);
  console.error('Create the folder and put your downloaded ChatGPT images there, then rerun the command.');
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const sourceFiles = fs.readdirSync(sourceDir)
  .filter(name => exts.has(path.extname(name).toLowerCase()))
  .map(name => {
    const fullPath = path.join(sourceDir, name);
    const stat = fs.statSync(fullPath);
    return {
      name,
      fullPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size
    };
  })
  .filter(file => file.size > 0)
  .sort((a, b) => a.mtimeMs - b.mtimeMs);

if (sourceFiles.length < 20) {
  console.error(`Need at least 20 image files in ${sourceDir}, found ${sourceFiles.length}.`);
  process.exit(1);
}

const picked = sourceFiles.slice(-20);
const manifest = [];

for (let i = 0; i < picked.length; i += 1) {
  const number = String(i + 1).padStart(2, '0');
  const source = picked[i];
  const destination = path.join(targetDir, `${number}.jpg`);
  const placeholder = path.join(targetDir, `${number}.svg`);

  if (fs.existsSync(destination) && !overwrite) {
    console.error(`Target exists: ${destination}. Re-run with OVERWRITE=1 to replace it.`);
    process.exit(1);
  }

  fs.copyFileSync(source.fullPath, destination);
  if (fs.existsSync(placeholder)) {
    fs.unlinkSync(placeholder);
  }

  manifest.push({
    slot: number,
    sourceFile: source.name,
    outputFile: `${number}.jpg`
  });
}

fs.writeFileSync(
  path.join(targetDir, 'imported-files.json'),
  JSON.stringify(
    {
      importedAt: new Date().toISOString(),
      sourceDir,
      items: manifest
    },
    null,
    2
  )
);

console.log(`Imported ${picked.length} images from ${sourceDir}`);
console.log(`Saved as 01.jpg to 20.jpg in ${targetDir}`);
