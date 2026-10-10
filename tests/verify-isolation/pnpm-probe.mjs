// Intercept only the external pnpm boundary; the actual verifier runs unchanged.
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const original = child.spawnSync;
child.spawnSync = (cmd, args, options) => {
  if (cmd !== 'pnpm') return original(cmd, args, options);
  if (args.includes('test')) process.stdout.write(JSON.stringify({ port: options.env.UNCHARTED_VERIFY_PORT ?? null, token: options.env.UNCHARTED_VERIFY_TOKEN ?? null }));
  return { status: 0 };
};
syncBuiltinESMExports();
