/**
 * Child-only network guard for isolated browser integration tests.
 * Allows loopback networking and rejects non-loopback native and fetch traffic.
 * The runner sets ASTANA_TEST_NETWORK_GUARD=1 only for its disposable Next process.
 */
if (process.env.ASTANA_TEST_NETWORK_GUARD === '1') {
  const { createRequire, syncBuiltinESMExports } = await import('node:module');
  const require = createRequire(import.meta.url);
  const net = require('node:net');
  const http = require('node:http');
  const https = require('node:https');
  const loopbackHosts = new Set(['127.0.0.1', '::1', '[::1]']);
  const assertLoopback = (host) => {
    if (!loopbackHosts.has(String(host || '').toLowerCase())) {
      throw new Error(`ASTANA isolated-test network guard rejected non-loopback host: ${host || '(missing)'}`);
    }
  };
  const assertSocketTarget = (args) => {
    const target = args[0];
    if (Array.isArray(target)) {
      if (typeof target[0] === 'number') {
        assertLoopback(typeof target[1] === 'string' ? target[1] : 'localhost');
        if (!target.slice(2).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA isolated-test network guard rejected unknown normalized socket target');
      } else if (typeof target[0] === 'string' && typeof target[1] === 'number') {
        assertLoopback(target[0]);
        if (!target.slice(2).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA isolated-test network guard rejected unknown normalized socket target');
      } else if (target[0] && typeof target[0] === 'object' && !target[0].path) {
        assertLoopback(target[0].host || target[0].hostname || 'localhost');
        if (!target.slice(1).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA isolated-test network guard rejected unknown normalized socket target');
      } else throw new Error('ASTANA isolated-test network guard rejected unknown socket target');
      return;
    }
    if (typeof target === 'number') assertLoopback(typeof args[1] === 'string' ? args[1] : 'localhost');
    else if (target && typeof target === 'object' && !target.path) assertLoopback(target.host || target.hostname);
    else throw new Error('ASTANA isolated-test network guard rejected unknown socket target');
  };

  const originalSocketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    assertSocketTarget(args);
    return originalSocketConnect.apply(this, args);
  };
  const originalConnect = net.connect;
  const guardedConnect = function (...args) {
    assertSocketTarget(args);
    return originalConnect.apply(this, args);
  };
  net.connect = guardedConnect;
  net.createConnection = guardedConnect;

  const guardHttpRequest = (module) => {
    const original = module.request;
    module.request = function (...args) {
      const target = args[0];
      if (typeof target === 'string' || target instanceof URL) assertLoopback(new URL(target).hostname);
      else if (target && typeof target === 'object') assertLoopback(target.hostname || target.host);
      else throw new Error('ASTANA isolated-test network guard rejected unknown HTTP target');
      return original.apply(this, args);
    };
  };
  guardHttpRequest(http);
  guardHttpRequest(https);
  const dns = require('node:dns');
  const guardDnsLookup = (module) => {
    const original = module.lookup;
    module.lookup = function (hostname, ...args) {
      assertLoopback(hostname);
      return original.call(this, hostname, ...args);
    };
    for (const method of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt']) {
      if (typeof module[method] !== 'function') continue;
      const originalResolve = module[method];
      module[method] = function (hostname, ...args) {
        assertLoopback(hostname);
        return originalResolve.call(this, hostname, ...args);
      };
    }
  };
  guardDnsLookup(dns);
  const dnsPromises = require('node:dns/promises');
  for (const method of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt']) {
    if (typeof dnsPromises[method] !== 'function') continue;
    const original = dnsPromises[method].bind(dnsPromises);
    dnsPromises[method] = (hostname, ...args) => {
      assertLoopback(hostname);
      return original(hostname, ...args);
    };
  }
  const dgram = require('node:dgram');
  const rejectUdp = () => { throw new Error('ASTANA isolated-test network guard rejected UDP sockets'); };
  const rejectDns = () => { throw new Error('ASTANA isolated-test network guard rejected DNS resolver access'); };
  dgram.createSocket = rejectUdp;
  dgram.Socket = rejectUdp;
  const guardResolver = (Resolver) => {
    if (!Resolver?.prototype) return;
    for (const method of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse', 'setServers']) {
      if (typeof Resolver.prototype[method] === 'function') Resolver.prototype[method] = rejectDns;
    }
  };
  guardResolver(dns.Resolver);
  guardResolver(dnsPromises.Resolver);
  syncBuiltinESMExports();

  const { Agent, Dispatcher, setGlobalDispatcher } = await import('undici');
  const assert = (await import('node:assert/strict')).default;
  const localAgent = new Agent();
  class LoopbackOnlyDispatcher extends Dispatcher {
    dispatch(options, handler) {
      try {
        assertLoopback(new URL(String(options.origin)).hostname);
        return localAgent.dispatch(options, handler);
      } catch (error) {
        handler.onError(error);
        return true;
      }
    }
    close() { return localAgent.close(); }
    destroy(error) { return localAgent.destroy(error); }
  }
  setGlobalDispatcher(new LoopbackOnlyDispatcher());
  assert.throws(() => net.connect({ host: 'example.invalid', port: 443 }), /non-loopback host/);
  assert.throws(() => http.request('http://example.invalid/'), /non-loopback host/);
  await assert.rejects(fetch('https://example.invalid/'), (error) =>
    error?.cause?.message?.includes('non-loopback host: example.invalid') === true);
  assert.throws(() => dns.resolve4('example.invalid', () => {}), /non-loopback host/);
  assert.throws(() => new dns.Resolver().resolve4('example.invalid', () => {}), /DNS resolver access/);
  assert.throws(() => dgram.createSocket('udp4'), /UDP sockets/);
}
