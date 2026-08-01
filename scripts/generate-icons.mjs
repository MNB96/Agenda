import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = __dirname + '/..'

// Full icon SVG (with background rect) — for icon.png
const fullSvg = readFileSync(`${root}/assets/icon-source.svg`, 'utf8')

// Adaptive icon foreground SVG — no background rect, content scaled into safe zone
// Android safe zone = center 66% of the image, so we add padding ~17% each side
// At 1024px: padding = ~174px → scale from 512 to 676px, centered in 1024
const adaptiveSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(176, 176) scale(1.32)">
    <path d="M315 100 C202 76 103 157 103 270 C103 380 193 430 282 421 C323 417 359 401 386 377" stroke="#72CBDC" stroke-width="31" stroke-linecap="round"/>
    <path d="M350 111 C366 117 381 125 394 135" stroke="#B2D9CD" stroke-width="31" stroke-linecap="round"/>
    <path d="M414 158 C425 172 433 187 439 202" stroke="#E8E5B9" stroke-width="31" stroke-linecap="round"/>
    <path d="M447 231 C449 248 449 264 447 280" stroke="#FF8924" stroke-width="31" stroke-linecap="round"/>
    <path d="M438 309 C432 325 424 340 414 353" stroke="#FF6800" stroke-width="31" stroke-linecap="round"/>
    <path d="M192 264 L241 313 L342 207" stroke="#293A49" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

async function run() {
  // icon.png — 1024x1024 (iOS + general)
  await sharp(Buffer.from(fullSvg))
    .resize(1024, 1024)
    .png()
    .toFile(`${root}/assets/icon.png`)
  console.log('✓ icon.png')

  // adaptive-icon.png — 1024x1024 foreground (Android, transparent bg)
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(`${root}/assets/adaptive-icon.png`)
  console.log('✓ adaptive-icon.png')

  console.log('Iconos generados correctamente.')
}

run().catch((e) => { console.error(e); process.exit(1) })
