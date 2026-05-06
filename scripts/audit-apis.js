const fs = require('fs');
const path = require('path');

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'CRON_SECRET'
];

// Manually parse .env for the audit
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.join('=').trim();
    }
  });
}

async function audit() {
  console.log('🔍 Starting StreetScan API & Environment Audit...\n');

  // 1. Check Environment Variables
  console.log('📁 Checking Environment Variables:');
  const missing = [];
  REQUIRED_ENV.forEach(env => {
    if (!process.env[env]) {
      missing.push(env);
      console.log(`❌ ${env} is missing!`);
    } else {
      console.log(`✅ ${env} is present.`);
    }
  });

  const yoloUrl = process.env.NEXT_PUBLIC_YOLO_SERVICE_URL;
  if (yoloUrl && yoloUrl.includes('render.com/docs')) {
    console.log('⚠️  NEXT_PUBLIC_YOLO_SERVICE_URL looks like a placeholder documentation link.');
  }

  if (missing.length > 0) {
    console.log('\n🚨 CRITICAL: Missing environment variables. Deployment will likely fail.');
  } else {
    console.log('\n✨ Environment variables look good.');
  }

  // 2. Check API Routes for Common Issues
  console.log('\n📂 Auditing API Routes for logic traps:');
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  function walk(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file === 'route.ts') {
        const content = fs.readFileSync(fullPath, 'utf8');
        const relativePath = path.relative(process.cwd(), fullPath);
        
        // Check for missing crypto import if randomUUID is used
        if (content.includes('randomUUID') && !content.includes("import crypto from 'crypto'")) {
          console.log(`❌ ${relativePath}: Uses randomUUID but missing crypto import!`);
        } else if (content.includes('randomUUID')) {
           console.log(`✅ ${relativePath}: randomUUID handled correctly.`);
        }

        // Check for suspicious exports (Next.js 13/14 restricted exports)
        const exports = content.match(/export (async )?function (\w+)/g);
        if (exports) {
          const invalidExports = exports.filter(e => {
            const name = e.split(' ').pop();
            return !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'dynamic', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion'].includes(name);
          });
          if (invalidExports.length > 0) {
            console.log(`⚠️  ${relativePath}: Found non-standard exports: ${invalidExports.join(', ')}`);
          }
        }
      }
    });
  }

  walk(apiDir);

  console.log('\n✅ Audit complete. Fix the identified issues before deploying.');
}

audit().catch(console.error);
