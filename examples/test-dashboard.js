#!/usr/bin/env node
/**
 * Quick test script for CSIS Dashboard
 * Run this after installing dashboard to verify it works
 */

console.log('=== CSIS Dashboard Quick Test ===\n');

const http = require('http');

// Test if dashboard server is running
console.log('1. Testing dashboard server on port 3000...');
const req = http.request('http://localhost:3000', { method: 'GET', timeout: 3000 }, (res) => {
  if (res.statusCode === 200) {
    console.log('   ✓ Dashboard server is running on port 3000');
    console.log('   Open http://localhost:3000 in your browser to access the dashboard\n');
  } else {
    console.log(`   ✗ Server responded with status ${res.statusCode}`);
  }
});

req.on('error', (err) => {
  console.log('   ✗ Dashboard server not running on port 3000');
  console.log('   Error:', err.message);
  console.log('\n   To start dashboard:');
  console.log('   1. Ensure OpenClaw with roter is running');
  console.log('   2. Make sure "dashboard" mod is enabled (roter enable dashboard)');
  console.log('   3. Restart OpenClaw\n');
});

req.on('timeout', () => {
  console.log('   ✗ Connection timeout - server may not be running');
  req.destroy();
});

req.end();

// Test API endpoints
setTimeout(() => {
  console.log('2. Testing dashboard API endpoints...');
  
  const endpoints = ['/api/components', '/api/layout'];
  
  endpoints.forEach(endpoint => {
    const apiReq = http.request(`http://localhost:3000${endpoint}`, { method: 'GET', timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`   ✓ ${endpoint}: OK (${Object.keys(json).length} items)`);
        } catch {
          console.log(`   ✓ ${endpoint}: OK (status ${res.statusCode})`);
        }
      });
    });
    
    apiReq.on('error', () => {
      console.log(`   ✗ ${endpoint}: Not accessible`);
    });
    
    apiReq.end();
  });
  
  setTimeout(() => {
    console.log('\n3. Summary:');
    console.log('   - Dashboard should be accessible at http://localhost:3000');
    console.log('   - If not running, ensure mod is enabled and OpenClaw is restarted');
    console.log('   - For more help, see README.md at https://github.com/cuiJY-still-in-school/CSIS-dashboard');
    console.log('\n=== Test Complete ===\n');
  }, 1000);
  
}, 1000);