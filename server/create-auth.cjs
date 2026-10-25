// Supply password on stdin; only its salted scrypt hash is written to stdout.
const fs = require('node:fs');
const crypto = require('node:crypto');
const password = fs.readFileSync(0, 'utf8').trimEnd();
if (password.length < 16) throw Error('Use a password of at least 16 characters');
const salt = crypto.randomBytes(16).toString('hex');
console.log(JSON.stringify({ username: process.argv[2] || 'nikolai', salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') }));
