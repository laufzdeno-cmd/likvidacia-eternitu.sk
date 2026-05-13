import { scryptSync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Použitie: npm run admin:hash -- "silne-heslo"');
  process.exit(1);
}

const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password, salt, 64).toString('base64url');
console.log(`${salt}:${hash}`);
