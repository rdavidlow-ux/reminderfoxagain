// Joins the arm64 and x64 apps into one universal app with @electron/universal, on Linux: the library checks for
// darwin and calls lipo, so the check is passed and build/macos/lipo (on PATH) does the joining.
import path from 'node:path';
Object.defineProperty(process, 'platform', { value: 'darwin' });
const { makeUniversalApp } = await import('@electron/universal');
const [x64, arm64, out] = process.argv.slice(2).map((p) => path.resolve(p));
await makeUniversalApp({ x64AppPath: x64, arm64AppPath: arm64, outAppPath: out, force: true });
