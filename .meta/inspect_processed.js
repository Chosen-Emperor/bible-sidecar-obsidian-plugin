const fs = require('fs');

const path = 'C:\\Users\\rayni\\Documents\\Obsidian Vault\\.obsidian\\plugins\\bible-sidecar-plus\\translations\\ESV.json';
if (!fs.existsSync(path)) {
	console.log("ESV.json not found in plugin folder");
	process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const rawHtml = data.passages['41']['1'].html;

console.log("Raw HTML:");
console.log(rawHtml);
