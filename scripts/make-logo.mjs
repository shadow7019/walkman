// One-off: generate Walkman app icon variants from the uploaded logo.
import sharp from 'sharp'
import { copyFile } from 'node:fs/promises'

const SRC = '/home/z/my-project/upload/Minimal Walkman Wave Logo.png'

async function main() {
  // favicon (Next.js App Router picks this up automatically)
  await sharp(SRC).resize(512, 512, { fit: 'cover' }).png({ quality: 90 }).toFile('/home/z/my-project/src/app/icon.png.tmp')
  // iOS home-screen icon
  await sharp(SRC).resize(180, 180, { fit: 'cover' }).png().toFile('/home/z/my-project/src/app/apple-icon.png.tmp')
  // in-app logo asset (crisp at 2x for the 32-40px sidebar brand + used elsewhere)
  await sharp(SRC).resize(256, 256, { fit: 'cover' }).png().toFile('/home/z/my-project/public/logo.png.tmp')

  // atomic-ish rename
  const { rename } = await import('node:fs/promises')
  await rename('/home/z/my-project/src/app/icon.png.tmp', '/home/z/my-project/src/app/icon.png')
  await rename('/home/z/my-project/src/app/apple-icon.png.tmp', '/home/z/my-project/src/app/apple-icon.png')
  await rename('/home/z/my-project/public/logo.png.tmp', '/home/z/my-project/public/logo.png')

  // keep an original-resolution copy for large surfaces
  await copyFile(SRC, '/home/z/my-project/public/logo-full.png')

  const meta = await sharp('/home/z/my-project/src/app/icon.png').metadata()
  console.log('icon.png:', meta.width, 'x', meta.height)
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) })
