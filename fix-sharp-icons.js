const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceImage = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0872a2a4-1d62-4298-9aa1-cdd8a0205f7a\\meoxinh_sharp_icon_1778222230679.png';

async function generateIcons() {
  const appDir = path.join(__dirname, 'app');
  const publicDir = path.join(__dirname, 'public');

  try {
    // We use lanczos3 kernel for highest quality downscaling
    const resizeOpts = { kernel: sharp.kernel.lanczos3, fastShrinkOnLoad: false };

    await sharp(sourceImage).resize(64, 64, resizeOpts).toFile(path.join(appDir, 'icon.png'));
    await sharp(sourceImage).resize(180, 180, resizeOpts).toFile(path.join(publicDir, 'apple-touch-icon.png'));
    await sharp(sourceImage).resize(192, 192, resizeOpts).toFile(path.join(publicDir, 'pwa-icon-192.png'));
    await sharp(sourceImage).resize(512, 512, resizeOpts).toFile(path.join(publicDir, 'pwa-icon-512.png'));
    console.log('Fixed icons with sharp quality!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
