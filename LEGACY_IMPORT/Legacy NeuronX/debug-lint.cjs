const fs = require('fs');
const { execSync } = require('child_process');

try {
  console.log('Running lint...');
  execSync('pnpm run lint --format json > lint_output.json', { stdio: 'inherit' });
} catch (e) {
  // Expected to fail
}

const content = fs.readFileSync('lint_output.json', 'utf8');
// Find the JSON array
const start = content.indexOf('[');
const end = content.lastIndexOf(']');
const json = JSON.parse(content.substring(start, end + 1));

const files = json.filter(f => f.errorCount > 0);
files.sort((a, b) => b.errorCount - a.errorCount);

console.log(`Total errors: ${files.reduce((s, f) => s + f.errorCount, 0)}`);
console.log('Files with errors:');
files.forEach(f => {
  console.log(`${f.filePath}: ${f.errorCount}`);
});
