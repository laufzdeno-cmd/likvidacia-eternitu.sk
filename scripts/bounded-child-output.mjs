import { spawn } from 'node:child_process';
import { exceedsTextCaptureLimit } from './bounded-text-capture.mjs';

export function runBoundedChild(command, args, { cwd, env, timeoutMs, maxStdoutBytes, maxStderrBytes = 4 * 1024 * 1024 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let stdoutLimitExceeded = false;
    let stderrLimitExceeded = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (exceedsTextCaptureLimit(stdoutBytes, chunk.length, maxStdoutBytes)) {
        stdoutLimitExceeded = true;
        child.kill();
        return;
      }
      stdoutChunks.push(chunk);
      stdoutBytes += chunk.length;
    });
    child.stderr.on('data', (chunk) => {
      if (exceedsTextCaptureLimit(stderrBytes, chunk.length, maxStderrBytes)) {
        stderrLimitExceeded = true;
        child.kill();
        return;
      }
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      resolve({
        status: timedOut || stdoutLimitExceeded || stderrLimitExceeded ? null : status,
        signal,
        stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString('utf8'),
        stdoutBytes,
        stdoutLimitExceeded,
        stderr: Buffer.concat(stderrChunks, stderrBytes).toString('utf8'),
        stderrBytes,
        stderrLimitExceeded,
        error: timedOut
          ? new Error(`Child process timed out after ${timeoutMs} ms`)
          : stdoutLimitExceeded
            ? new Error(`Child stdout exceeded its ${maxStdoutBytes}-byte limit`)
            : stderrLimitExceeded
              ? new Error(`Child stderr exceeded its ${maxStderrBytes}-byte limit`)
            : undefined,
      });
    });
  });
}
