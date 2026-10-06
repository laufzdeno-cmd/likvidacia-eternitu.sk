import http from 'node:http';

export async function createLighthouseNetworkProxy(allowedOrigin) {
  const allowed = new URL(allowedOrigin);
  if (allowed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(allowed.hostname) || !allowed.port) {
    throw new Error('Lighthouse proxy requires an explicit loopback HTTP origin and port.');
  }

  const server = http.createServer((request, response) => {
    let target;
    try { target = new URL(request.url || ''); } catch {
      response.writeHead(400).end();
      return;
    }
    if (target.origin !== allowed.origin || target.protocol !== 'http:' || target.username || target.password) {
      response.writeHead(403, { 'content-type': 'text/plain' }).end('Blocked by isolated Lighthouse network policy');
      return;
    }
    const headers = { ...request.headers, host: allowed.host };
    delete headers['proxy-connection'];
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: allowed.port,
      method: request.method,
      path: target.pathname + target.search,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.on('error', () => response.destroy());
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on('aborted', () => upstream.destroy());
    request.on('error', () => upstream.destroy());
    response.on('error', () => upstream.destroy());
    response.on('close', () => {
      if (!upstream.destroyed) upstream.destroy();
    });
    request.pipe(upstream);
  });

  server.on('connect', (_request, socket) => {
    // Browsers may cancel a rejected HTTPS tunnel immediately; that reset is
    // expected under the deny-by-default proxy and must not crash the runner.
    socket.on('error', () => {});
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  server.unref();
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
