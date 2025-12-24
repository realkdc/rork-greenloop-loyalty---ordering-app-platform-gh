/**
 * Script to create a sideload variant of the app icon with a badge indicator
 * This adds a small "SL" badge in the bottom-right corner to distinguish from Google Play version
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available (lightweight image processing)
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Sharp not found. Installing...');
  console.error('Please run: npm install sharp --save-dev');
  process.exit(1);
}

async function createSideloadIcon() {
  const inputPath = path.join(__dirname, '../assets/images/icon.png');
  const outputPath = path.join(__dirname, '../assets/images/icon-sideload.png');
  const adaptiveOutputPath = path.join(__dirname, '../assets/images/adaptive-icon-sideload.png');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input icon not found: ${inputPath}`);
    process.exit(1);
  }

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const size = metadata.width; // Assuming square icon
    
    // Create a badge SVG - small "SL" text in bottom-right corner
    const badgeSize = size * 0.25; // 25% of icon size
    const badgeX = size - badgeSize - (size * 0.05); // 5% padding from edge
    const badgeY = size - badgeSize - (size * 0.05);
    
    const badgeSvg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <!-- Badge background circle -->
        <circle cx="${badgeX + badgeSize/2}" cy="${badgeY + badgeSize/2}" 
                r="${badgeSize/2 * 0.9}" fill="#1E4D3A" stroke="#FFFFFF" stroke-width="${size * 0.01}"/>
        <!-- SL text -->
        <text x="${badgeX + badgeSize/2}" y="${badgeY + badgeSize/2}" 
              font-family="Arial, sans-serif" font-size="${badgeSize * 0.4}" 
              font-weight="bold" fill="#FFFFFF" text-anchor="middle" 
              dominant-baseline="central">SL</text>
      </svg>
    `;

    // Composite the badge onto the original icon
    const output = await image
      .composite([{
        input: Buffer.from(badgeSvg),
        top: 0,
        left: 0
      }])
      .png()
      .toFile(outputPath);

    // Also create adaptive icon version
    await sharp(inputPath)
      .composite([{
        input: Buffer.from(badgeSvg),
        top: 0,
        left: 0
      }])
      .png()
      .toFile(adaptiveOutputPath);

    console.log('✅ Sideload icon created successfully!');
    console.log(`   Main icon: ${outputPath}`);
    console.log(`   Adaptive icon: ${adaptiveOutputPath}`);
  } catch (error) {
    console.error('Error creating sideload icon:', error);
    process.exit(1);
  }
}

createSideloadIcon();

