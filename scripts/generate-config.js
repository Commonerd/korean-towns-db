const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

const envPath = path.resolve(__dirname, '..', '.env');
const outPath = path.resolve(__dirname, '..', 'env-config.js');
let env = {};

try {
  env = parseEnv(fs.readFileSync(envPath, 'utf8'));
} catch (error) {
  console.warn('.env 파일을 찾을 수 없습니다. 빈 구성으로 env-config.js를 생성합니다.');
}

const config = {
  spreadsheetId: env.SPREADSHEET_ID || '',
  geminiApiKey: env.GEMINI_API_KEY || ''
};

const output = `window.APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(outPath, output, 'utf8');
console.log('Generated env-config.js');
