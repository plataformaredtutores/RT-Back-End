/**
 * Helper script to generate JWT_SECRET and ARGON2_SECRET_PEPPER for testing
 * Run with: node scripts/generate-test-secrets.js
 */

const crypto = require('crypto');

// Generate random secrets
const jwtSecret = crypto.randomBytes(32).toString('base64');
const argon2Pepper = crypto.randomBytes(32).toString('base64');

console.log('\n=== Test Environment Secrets ===\n');
console.log('Add these to your .env.test file:\n');
console.log(`JWT_SECRET=base64:${jwtSecret}`);
console.log(`ARGON2_SECRET_PEPPER=base64:${argon2Pepper}`);
console.log('\n');

