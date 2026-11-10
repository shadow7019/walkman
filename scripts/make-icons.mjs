// Generates all PWA / APK icon sizes from public/logo.png using sharp.
// Run: bun scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = 'public/logo.png'
const OUT = 'public'
mkdirSync(OUT, { recursive: true })

const BG = { r: 9, g: 9, b: 11, alpha: 1 } // #09090b theme background

async function square(size, name, { maskable = false } = {}) {
  // maskable icons need the artwork inside the central 80% safe zone
  const art = maskable ? Math.round(size * 0.72) : Math.round(size * 0.92)
  const pad = Math.round((size - art) / 2)
  const resized = await sharp(SRC).resize(art, art, { fit: 'contain', background: BG }).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: maskable ? BG : { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toFile(`${OUT}/${name}`)
  console.log('wrote', name)
}

await square(192, 'icon-192.png')
await square(512, 'icon-512.png')
await square(192, 'maskable-192.png', { maskable: true })
await square(512, 'maskable-512.png', { maskable: true })
await square(180, 'apple-touch-icon.png', { maskable: true })

// APK launcher icons (legacy mipmap densities)
const DENSITIES = [
  ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
]
mkdirSync('apk/res', { recursive: true })
for (const [dpi, size] of DENSITIES) {
  mkdirSync(`apk/res/mipmap-${dpi}`, { recursive: true })
  const art = Math.round(size * 0.92)
  const pad = Math.round((size - art) / 2)
  const resized = await sharp(SRC).resize(art, art, { fit: 'contain', background: BG }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toFile(`apk/res/mipmap-${dpi}/ic_launcher.png`)
  console.log('wrote mipmap-' + dpi)
}
console.log('done')
