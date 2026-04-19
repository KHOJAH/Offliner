const { spawn } = require('child_process');
const { join } = require('path');

const workerPath = join(__dirname, '..', 'dist', 'worker', 'index.js');
const worker = spawn('node', [workerPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' },
});

let stdoutBuffer = '';
worker.stdout.setEncoding('utf8');
worker.stdout.on('data', (chunk) => {
  stdoutBuffer += chunk;
  let lineEndIndex;
  while ((lineEndIndex = stdoutBuffer.indexOf('\n')) !== -1) {
    const line = stdoutBuffer.slice(0, lineEndIndex).trim();
    stdoutBuffer = stdoutBuffer.slice(lineEndIndex + 1);
    if (!line) continue;
    try {
      const event = JSON.parse(line);
      if (event.action === 'metadata') {
        console.log('SUCCESS: Received metadata for', event.data.title);
        console.log('Metadata size:', JSON.stringify(event).length, 'bytes');
        process.exit(0);
      } else if (event.action === 'error') {
        console.error('ERROR from worker:', event.message);
        process.exit(1);
      }
    } catch (err) {
      console.error('Failed to parse line:', line.slice(0, 100));
    }
  }
});

worker.stderr.on('data', (data) => console.error('Worker stderr:', data.toString()));

const cmd = {
  type: 'command',
  id: 'test-uuid',
  action: 'metadata',
  args: { url: 'https://youtu.be/2Xulk9Ahqmc' }
};

console.log('Sending metadata command to worker...');
worker.stdin.write(JSON.stringify(cmd) + '\n');

setTimeout(() => {
  console.error('TIMEOUT: Worker did not respond with metadata within 20s');
  worker.kill();
  process.exit(1);
}, 20000);
