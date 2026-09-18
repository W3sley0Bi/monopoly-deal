const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();

  // Prioritize primary macOS Wi-Fi interface (en0)
  if (interfaces['en0']) {
    const match = interfaces['en0'].find(
      (details) => details.family === 'IPv4' && !details.internal && !details.address.startsWith('169.254.')
    );
    if (match) return match.address;
  }

  // Fallback to any active non-internal IPv4 interface
  for (const name of Object.keys(interfaces)) {
    if (name === 'en0') continue;
    const iface = interfaces[name];
    if (!iface) continue;
    const match = iface.find(
      (details) => details.family === 'IPv4' && !details.internal && !details.address.startsWith('169.254.')
    );
    if (match) return match.address;
  }

  return 'localhost';
}

const ip = getLocalIp();
const projectRoot = path.resolve(__dirname, '..');
const envDevPath = path.join(projectRoot, '.env.dev');
const envPath = path.join(projectRoot, '.env');

const content = `EXPO_PUBLIC_SERVER_URL=ws://${ip}:8080/ws\n`;

fs.writeFileSync(envDevPath, content, 'utf8');
fs.writeFileSync(envPath, content, 'utf8');
console.log(`[sync-dev-ip] Updated .env.dev and .env with local IP: ws://${ip}:8080/ws`);

