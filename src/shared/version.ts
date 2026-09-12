import * as fs from 'fs';
import * as path from 'path';

const FALLBACK_VERSION = '0.0.0';
let cached: string | undefined;

/**
 * Reads the extension's own version out of its `package.json` at runtime.
 *
 * `__dirname` resolves to `<extension>/out/shared` both in the repo and
 * inside the packaged `.vsix` (vsce always ships `package.json`), so
 * `../../package.json` reaches the manifest in both cases. Falls back to
 * `0.0.0` if the manifest can't be read or parsed, so a malformed read never
 * breaks a caller such as the Codex app-server handshake.
 */
export function getExtensionVersion(): string {
  if (cached !== undefined) return cached;
  try {
    const manifestPath = path.join(__dirname, '..', '..', 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      version?: unknown;
    };
    cached =
      typeof manifest.version === 'string'
        ? manifest.version
        : FALLBACK_VERSION;
  } catch {
    cached = FALLBACK_VERSION;
  }
  return cached;
}
