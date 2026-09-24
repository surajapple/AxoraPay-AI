const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'server/package-lock.json',
  'server/package.json',
  'server/.env',
  'server/.env.example',
  'server/src/tests/agent.test.js',
  'server/src/index.js',
  'server/src/services/ai/aiProvider.js',
  'README.md',
  'package.json',
  'style.css',
  'client/index.html',
  'client/package-lock.json',
  'client/package.json',
  'client/.env',
  'client/src/components/Layout.jsx',
  'client/src/pages/ChatPage.jsx',
  'client/src/pages/LoginPage.jsx',
  'client/src/pages/LandingPage.jsx',
  'client/src/services/api.js',
  'app.js'
];

const basePath = '/Users/surajzaware/Downloads/Paytm-AI-Hackathon-main';

let totalReplacements = 0;

for (const file of files) {
  const fullPath = path.join(basePath, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    content = content.replace(/ResolveAI/g, 'AxoraPay');
    content = content.replace(/resolveai/g, 'axorapay'); // for emails and db name
    content = content.replace(/resolve-ai/g, 'axora-pay');
    content = content.replace(/resolve_ai/g, 'axora_pay');

    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Updated ${file}`);
      totalReplacements++;
    }
  } else {
    console.warn(`File not found: ${fullPath}`);
  }
}

console.log(`Total files modified: ${totalReplacements}`);
