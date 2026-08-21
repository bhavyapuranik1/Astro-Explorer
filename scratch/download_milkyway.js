import fs from 'fs';
import https from 'https';
import path from 'path';

const urls = [
  'https://raw.githubusercontent.com/turban/sky-map/master/images/milkyway.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/ESO_-_The_Milky_Way_panorama_%28by%29.jpg/2560px-ESO_-_The_Milky_Way_panorama_%28by%29.jpg',
  'https://cdn.eso.org/images/publicationjpg/eso0932a.jpg'
];

const dest = path.resolve(process.cwd(), 'assets', 'milkyway.jpg');

function download(urlIndex) {
  if (urlIndex >= urls.length) {
    console.error('All download URLs failed.');
    process.exit(1);
  }

  const url = urls[urlIndex];
  console.log(`Downloading Milky Way texture from: ${url}`);

  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log(`Redirecting to: ${res.headers.location}`);
      https.get(res.headers.location, (redRes) => {
        saveStream(redRes, urlIndex);
      }).on('error', () => download(urlIndex + 1));
      return;
    }

    if (res.statusCode !== 200) {
      console.warn(`Failed with status ${res.statusCode}. Trying next URL...`);
      download(urlIndex + 1);
      return;
    }

    saveStream(res, urlIndex);
  }).on('error', (err) => {
    console.warn(`Error: ${err.message}. Trying next URL...`);
    download(urlIndex + 1);
  });
}

function saveStream(res, urlIndex) {
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close(() => {
      const stats = fs.statSync(dest);
      console.log(`Successfully saved assets/milkyway.jpg (${(stats.size / 1024).toFixed(1)} KB).`);
    });
  });
}

download(0);
