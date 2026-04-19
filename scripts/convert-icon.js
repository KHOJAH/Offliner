const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const inputPath = path.join(__dirname, '..', 'Pics', 'logo.png');
const outputPath = path.join(__dirname, '..', 'build', 'icon.png');

async function convert() {
  try {
    console.log('Converting JPEG to high-quality PNG...');
    
    // Read JPEG
    const image = await Jimp.read(inputPath);
    
    // Icons MUST be square. We'll crop/resize to 512x512 for high quality.
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.cover(512, 512); 
    
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    
    // Save as PNG
    await image.writeAsync(outputPath);
    
    console.log('Icon prepared successfully at build/icon.png');
  } catch (error) {
    console.error('Error preparing icon:', error);
    process.exit(1);
  }
}

convert();
