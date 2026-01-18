#!/usr/bin/env node

/**
 * Ollama Cloud Health Check Script
 * Tests connectivity and authentication to Ollama Cloud API
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  // Note: This would require dotenv, but we'll handle env vars manually for simplicity
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    if (line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value && !key.startsWith('#')) {
        process.env[key.trim()] = value;
      }
    }
  }
}

// Configuration
const API_BASES = ['https://api.ollama.ai', 'https://ollama.com'];

const API_KEY = process.env.OLLAMA_API_KEY;
const TEST_MODEL = 'glm-4.7';

console.log('🔍 Ollama Cloud Health Check');
console.log('============================\n');

// Check API key
console.log('API Key Status:');
console.log(`  OLLAMA_API_KEY set: ${!!API_KEY}`);
if (!API_KEY) {
  console.log('  ❌ ERROR: OLLAMA_API_KEY environment variable is not set');
  console.log('  💡 Set it in .env file or your shell environment');
  process.exit(1);
}
console.log('  ✅ API key is configured\n');

// Test each API base
async function testApiBase(baseUrl) {
  return new Promise(resolve => {
    console.log(`Testing API Base: ${baseUrl}`);

    const url = `${baseUrl}/api/tags`;
    const options = {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, res => {
      console.log(`  Status Code: ${res.statusCode}`);

      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('  ✅ SUCCESS: API is accessible');
          try {
            const data = JSON.parse(body);
            console.log(`  📋 Available models: ${data.models?.length || 0}`);
            if (data.models?.some(m => m.name?.includes(TEST_MODEL))) {
              console.log(`  ✅ Test model "${TEST_MODEL}" is available`);
            }
          } catch (e) {
            console.log('  ⚠️ Could not parse response JSON');
          }
        } else {
          console.log('  ❌ FAILED: Authentication or connectivity issue');
          console.log(`  Response: ${body.substring(0, 200)}...`);
        }
        resolve({
          baseUrl,
          statusCode: res.statusCode,
          success: res.statusCode === 200,
        });
      });
    });

    req.on('error', err => {
      console.log(`  ❌ ERROR: ${err.message}`);
      resolve({ baseUrl, error: err.message, success: false });
    });

    req.setTimeout(10000, () => {
      console.log('  ❌ TIMEOUT: Request took too long');
      req.destroy();
      resolve({ baseUrl, error: 'timeout', success: false });
    });

    req.end();
  });
}

async function runHealthCheck() {
  console.log('Testing API connectivity...\n');

  const results = [];
  for (const baseUrl of API_BASES) {
    const result = await testApiBase(baseUrl);
    results.push(result);
    console.log('');
  }

  // Summary
  console.log('📊 Summary:');
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    console.log(`✅ ${successful.length} API base(s) working:`);
    successful.forEach(r => console.log(`   - ${r.baseUrl}`));
    console.log('\n🎉 Ollama Cloud is accessible!');
    console.log(
      '💡 Update your .continue/config.yaml with the working API base'
    );
  } else {
    console.log('❌ No API bases are working');
    console.log('💡 Check your API key and network connectivity');
    console.log('🔗 Visit https://ollama.com for API documentation');
  }
}

runHealthCheck().catch(console.error);
