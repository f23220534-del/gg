const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(process.cwd(), 'config.json');

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(path.join(process.cwd(), 'config.example.json'), configPath);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig, configPath };
