import * as fs from 'fs';
import * as path from 'path';

export async function exists(
  file: string,
  platform = process.platform,
): Promise<boolean> {
  try {
    const metadata = await fs.promises.stat(file);
    if (!metadata.isFile()) return false;
    if (platform === 'win32') {
      return path.extname(file).toLowerCase() === '.exe';
    }

    await fs.promises.access(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findCommandOnPath(
  command: string,
  pathValue = process.env.PATH,
  platform = process.platform,
): Promise<string | undefined> {
  if (!pathValue) return undefined;

  const names =
    platform === 'win32' && !path.extname(command)
      ? [`${command}.exe`]
      : [command];
  const delimiter = platform === 'win32' ? ';' : ':';

  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (await exists(candidate, platform)) return candidate;
    }
  }

  return undefined;
}

export function isWindowsCommandShim(
  command: string,
  platform = process.platform,
): boolean {
  return platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}
