const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const buildYtDlpDir = path.join(__dirname, '..', 'build', 'yt-dlp');
const platforms = [
  { name: 'win32', file: 'yt-dlp.exe', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' },
  { name: 'darwin', file: 'yt-dlp', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos' },
  { name: 'linux', file: 'yt-dlp', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp' }
];

async function updateBinaries() {
  console.log('Checking and updating yt-dlp binaries...');
  const currentPlatform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';

  for (const plat of platforms) {
    // Priority: always ensure the current host platform binary is present and up to date
    if (plat.name !== currentPlatform && process.env.UPDATE_ALL_PLATFORMS !== 'true') {
      continue;
    }

    const platDir = path.join(buildYtDlpDir, plat.name);
    const binPath = path.join(platDir, plat.file);

    if (!fs.existsSync(platDir)) {
      fs.mkdirSync(platDir, { recursive: true });
    }

    if (fs.existsSync(binPath)) {
      try {
        console.log(`Updating existing yt-dlp binary for ${plat.name}...`);
        execSync(`"${binPath}" -U`, { stdio: 'inherit' });
        // Clean up any .old files left behind by yt-dlp update
        const oldFile = `${binPath}.old`;
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      } catch (err) {
        console.warn(`Could not run yt-dlp -U for ${plat.name} (continuing):`, err.message);
      }
    } else {
      console.log(`Downloading latest yt-dlp for ${plat.name}...`);
      try {
        await downloadFile(plat.url, binPath);
        if (plat.name !== 'win32') {
          fs.chmodSync(binPath, 0o755);
        }
        console.log(`Downloaded yt-dlp for ${plat.name}`);
      } catch (err) {
        console.warn(`Failed to download yt-dlp for ${plat.name} (continuing):`, err.message);
      }
    }
  }

  console.log('Binaries check completed.');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

updateBinaries().catch((err) => {
  console.warn('Binary update script completed with warning:', err.message);
});
