import { initializeDatabase } from '../src/server/db';

async function main() {
  await initializeDatabase();
  console.log('Databázové tabuľky sú pripravené.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
