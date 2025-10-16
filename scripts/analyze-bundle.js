#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function analyzeBundle() {
  log('blue', '📦 Analyzing Next.js bundle...');

  try {
    // Build the project first
    log('yellow', '⚡ Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    // Check if .next directory exists
    const nextDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(nextDir)) {
      log('red', '❌ Build directory not found. Run `npm run build` first.');
      process.exit(1);
    }

    // Analyze the bundle
    log('blue', '🔍 Bundle Analysis Results:');

    // Get build manifest
    const buildManifest = path.join(nextDir, 'build-manifest.json');
    if (fs.existsSync(buildManifest)) {
      const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'));

      log('green', '\n📄 Pages:');
      Object.keys(manifest.pages).forEach(page => {
        const files = manifest.pages[page];
        log('yellow', `  ${page}:`);
        files.forEach(file => {
          const filePath = path.join(nextDir, 'static', file);
          if (fs.existsSync(filePath)) {
            const size = fs.statSync(filePath).size;
            const sizeKB = (size / 1024).toFixed(2);
            log('reset', `    📎 ${file} (${sizeKB}KB)`);
          }
        });
      });
    }

    // Check for common large dependencies
    log('blue', '\n🔍 Checking for large dependencies...');

    const packageJson = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      const largeDeps = [
        '@tanstack/react-query',
        'lucide-react',
        '@radix-ui/react-dialog',
        'next-auth'
      ];

      largeDeps.forEach(dep => {
        if (pkg.dependencies && pkg.dependencies[dep]) {
          log('yellow', `  📦 ${dep}: ${pkg.dependencies[dep]}`);
        }
      });
    }

    // Performance recommendations
    log('green', '\n💡 Performance Recommendations:');
    log('reset', '  ✅ Use dynamic imports for large components');
    log('reset', '  ✅ Implement proper image optimization');
    log('reset', '  ✅ Use Next.js built-in bundle splitting');
    log('reset', '  ✅ Minimize third-party dependencies');
    log('reset', '  ✅ Use Server Components where possible');

    log('green', '\n✨ Bundle analysis complete!');

  } catch (error) {
    log('red', `❌ Error analyzing bundle: ${error.message}`);
    process.exit(1);
  }
}

// Add webpack bundle analyzer as optional
function runWebpackAnalyzer() {
  log('blue', '🔍 Running webpack bundle analyzer...');

  try {
    // Install analyzer if not present
    execSync('npm list @next/bundle-analyzer || npm install --save-dev @next/bundle-analyzer',
      { stdio: 'pipe' });

    // Update next.config.js temporarily
    const configPath = path.join(process.cwd(), 'next.config.js');
    let originalConfig = '';

    if (fs.existsSync(configPath)) {
      originalConfig = fs.readFileSync(configPath, 'utf8');

      // Add bundle analyzer
      const analyzerConfig = originalConfig.replace(
        'module.exports = nextConfig',
        `
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
        `
      );

      fs.writeFileSync(configPath, analyzerConfig);
    }

    // Run analyzer
    execSync('ANALYZE=true npm run build', { stdio: 'inherit' });

    // Restore original config
    if (originalConfig) {
      fs.writeFileSync(configPath, originalConfig);
    }

  } catch (error) {
    log('yellow', `⚠️  Webpack analyzer failed: ${error.message}`);
  }
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('--webpack')) {
  runWebpackAnalyzer();
} else {
  analyzeBundle();
}