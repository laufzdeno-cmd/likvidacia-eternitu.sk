import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { test } from 'node:test';
import { createLighthouseNetworkProxy } from './lighthouse-network-proxy.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function requestThroughProxy(proxyPort, target) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: proxyPort, path: target,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('Lighthouse proxy forwards only the exact loopback origin and port', async () => {
  const app = http.createServer((_request, response) => response.end('local app only'));
  await listen(app);
  const origin = `http://localhost:${app.address().port}`;
  const proxy = await createLighthouseNetworkProxy(origin);
  try {
    const allowed = await requestThroughProxy(proxy.port, `${origin}/health`);
    assert.deepEqual(allowed, { status: 200, body: 'local app only' });

    for (const blocked of [
      `http://localhost:${app.address().port + 1}/other-local-service`,
      `http://127.0.0.1:${app.address().port}/ip-literal`,
      `https://localhost:${app.address().port}/tls`,
      `http://user@localhost:${app.address().port}/userinfo`,
    ]) {
      const response = await requestThroughProxy(proxy.port, blocked);
      assert.equal(response.status, 403, `expected proxy to reject ${blocked}`);
    }

    const tunnelResponse = await new Promise((resolve, reject) => {
      const socket = net.connect(proxy.port, '127.0.0.1');
      let data = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => { data += chunk; });
      socket.once('error', reject);
      socket.once('close', () => resolve(data));
      socket.once('connect', () => socket.write('CONNECT 203.0.113.5:443 HTTP/1.1\r\nHost: 203.0.113.5:443\r\n\r\n'));
    });
    assert.match(tunnelResponse, /^HTTP\/1\.1 403 Forbidden/);

    await new Promise((resolve, reject) => {
      const socket = net.connect(proxy.port, '127.0.0.1');
      socket.once('error', reject);
      socket.once('close', resolve);
      socket.once('connect', () => {
        socket.write('CONNECT 203.0.113.5:443 HTTP/1.1\r\nHost: 203.0.113.5:443\r\n\r\n');
        socket.destroy();
      });
    });
  } finally {
    await proxy.close();
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});
