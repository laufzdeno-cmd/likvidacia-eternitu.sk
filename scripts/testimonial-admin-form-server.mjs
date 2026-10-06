import { createServer } from 'node:http';

const directory = process.env.ASTANA_TEST_APP_ROOT;
const port = Number(process.env.ASTANA_TEST_APP_PORT);
if (!directory || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('The isolated testimonial server requires a valid temporary project directory and local port.');
}

const next = (await import('next')).default;
const app = next({ dev: true, dir: directory, hostname: '127.0.0.1', port, webpack: true });
await app.prepare();
const server = createServer((request, response) => app.getRequestHandler()(request, response));
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

process.once('SIGTERM', async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await app.close();
  process.exit(0);
});
