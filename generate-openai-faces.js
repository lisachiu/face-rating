const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'photos');
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const START = Math.max(1, Number.parseInt(process.env.START || '1', 10));
const END = Math.min(20, Number.parseInt(process.env.END || '20', 10));
const OVERWRITE = process.env.OVERWRITE === '1';
const DELAY_MS = Math.max(0, Number.parseInt(process.env.DELAY_MS || '1200', 10));

const variants = [
  { age: 22, hair: 'short black hair with light fringe', face: 'slightly round face', build: 'slim', glasses: 'no glasses', outfit: 'plain white t-shirt', angle: 'front-facing', appeal: 'average but pleasant' },
  { age: 24, hair: 'side-parted short hair', face: 'square face', build: 'average build', glasses: 'black frame glasses', outfit: 'light blue button-up shirt', angle: 'slight three-quarter angle', appeal: 'average' },
  { age: 27, hair: 'buzz cut', face: 'long face', build: 'lean and lightly athletic', glasses: 'no glasses', outfit: 'dark gray hoodie', angle: 'front-facing', appeal: 'average to above average' },
  { age: 30, hair: 'short wavy hair', face: 'oval face', build: 'slim', glasses: 'thin metal glasses', outfit: 'beige knit top', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 21, hair: 'soft textured short hair', face: 'small round face', build: 'average build', glasses: 'no glasses', outfit: 'light gray sweatshirt', angle: 'front-facing', appeal: 'average' },
  { age: 25, hair: 'short hair with trimmed sides and longer top', face: 'diamond face', build: 'slim', glasses: 'no glasses', outfit: 'dark blue polo shirt', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 28, hair: 'medium short hair with slightly flipped ends', face: 'rounded square face', build: 'slightly chubby', glasses: 'round glasses', outfit: 'white shirt', angle: 'front-facing', appeal: 'plain and approachable' },
  { age: 31, hair: 'clean slicked-back short hair', face: 'rectangular face', build: 'average build', glasses: 'no glasses', outfit: 'dark plain shirt', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 23, hair: 'thick short hair', face: 'egg-shaped face', build: 'average build', glasses: 'no glasses', outfit: 'khaki t-shirt', angle: 'front-facing', appeal: 'average to above average' },
  { age: 26, hair: 'neat side part', face: 'square face', build: 'slim', glasses: 'thin frame glasses', outfit: 'black mock-neck top', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 29, hair: 'short naturally wavy hair', face: 'slightly round face', build: 'slightly chubby', glasses: 'no glasses', outfit: 'dark green t-shirt', angle: 'front-facing', appeal: 'average' },
  { age: 32, hair: 'clean short haircut', face: 'strong square jaw', build: 'solid build', glasses: 'no glasses', outfit: 'light gray casual blazer over white t-shirt', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 20, hair: 'medium short hair with a soft middle part', face: 'oval face', build: 'slim', glasses: 'clear frame glasses', outfit: 'tan hoodie', angle: 'front-facing', appeal: 'average and youthful' },
  { age: 27, hair: 'very short crew cut', face: 'rounded square face', build: 'average build', glasses: 'no glasses', outfit: 'black t-shirt', angle: 'front-facing', appeal: 'average' },
  { age: 33, hair: 'mature side-parted short hair', face: 'long face', build: 'average to sturdy build', glasses: 'no glasses', outfit: 'white shirt with top button open', angle: 'slight three-quarter angle', appeal: 'above average' },
  { age: 24, hair: 'smooth medium short hair', face: 'round face', build: 'average build', glasses: 'round glasses', outfit: 'light knit sweater', angle: 'front-facing', appeal: 'average and friendly' },
  { age: 28, hair: 'natural side-parted short hair', face: 'oval face', build: 'slim', glasses: 'no glasses', outfit: 'navy button-up shirt', angle: 'slight three-quarter angle', appeal: 'good-looking but understated' },
  { age: 35, hair: 'short hair with a mature feel', face: 'square face', build: 'slightly chubby', glasses: 'half-rim glasses', outfit: 'gray knit top', angle: 'front-facing', appeal: 'average to above average' },
  { age: 26, hair: 'short hair with forehead slightly visible', face: 'oval face', build: 'average build', glasses: 'no glasses', outfit: 'white zip hoodie', angle: 'slight three-quarter angle', appeal: 'clean-cut and above average' },
  { age: 34, hair: 'short hair with a slight natural wave', face: 'rectangular face', build: 'average build', glasses: 'no glasses', outfit: 'dark gray henley shirt', angle: 'front-facing', appeal: 'average and mature' }
];

function readEnvValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  for (const filename of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, filename);
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      if (key !== name) {
        continue;
      }

      const rawValue = trimmed.slice(separator + 1).trim();
      return rawValue.replace(/^['"]|['"]$/g, '');
    }
  }

  return '';
}

const API_KEY = readEnvValue('OPENAI_API_KEY');

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

if (START > END) {
  console.error(`Invalid range: START=${START}, END=${END}`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function filenameFor(index) {
  return `${String(index).padStart(2, '0')}.jpg`;
}

function buildPrompt(index, variant) {
  return [
    'Ultra-realistic head-and-shoulders portrait photo of a Taiwanese man.',
    `Age ${variant.age}.`,
    `Hairstyle: ${variant.hair}.`,
    `Face shape: ${variant.face}.`,
    `Body impression: ${variant.build}.`,
    `Eyewear: ${variant.glasses}.`,
    `Clothing: ${variant.outfit}.`,
    `Pose: ${variant.angle}.`,
    `Overall attractiveness should read as ${variant.appeal}; keep a natural distribution from average to attractive and do not make every subject conventionally handsome.`,
    'Natural daylight, realistic skin texture, white or light gray simple background, social profile photo or ID-style portrait consistency, one person only.',
    'Natural relaxed expression, authentic Taiwanese facial features, realistic camera photo, minimal retouching, neutral framing.',
    'No text, no watermark, no logo, no extra people, no hands near the face, no dramatic shadows, no beauty filter, no surreal artifacts, no exaggerated symmetry.',
    `This is portrait ${index} of 20, so the person must look distinct from the others while keeping the same overall photographic style.`
  ].join(' ');
}

async function fetchAsBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image URL: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'jpeg',
      output_compression: 90
    })
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  const item = payload?.data?.[0];
  if (!item) {
    throw new Error('Image API returned no image data');
  }
  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64');
  }
  if (item.url) {
    return fetchAsBuffer(item.url);
  }

  throw new Error('Unsupported image response format');
}

async function main() {
  const metadata = [];

  for (let index = START; index <= END; index += 1) {
    const variant = variants[index - 1];
    const filename = filenameFor(index);
    const outputPath = path.join(OUT_DIR, filename);
    const placeholderPath = path.join(OUT_DIR, `${String(index).padStart(2, '0')}.svg`);
    const prompt = buildPrompt(index, variant);

    if (fs.existsSync(outputPath) && !OVERWRITE) {
      console.log(`Skip ${filename} (already exists)`);
      metadata.push({ index, filename, prompt, skipped: true });
      continue;
    }

    console.log(`Generating ${filename} with ${MODEL}...`);
    const imageBuffer = await generateImage(prompt);
    fs.writeFileSync(outputPath, imageBuffer);

    if (fs.existsSync(placeholderPath)) {
      fs.unlinkSync(placeholderPath);
    }

    metadata.push({ index, filename, prompt });
    console.log(`Saved ${filename}`);

    if (index < END && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'prompts.generated.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: MODEL,
        range: { start: START, end: END },
        items: metadata
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
