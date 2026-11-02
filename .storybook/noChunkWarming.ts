import { vi } from 'vite-plus/test';
import * as appChunks from '../src/components/app/appChunks';

/**
 * The story-test counterpart of `src/test/noChunkWarming.ts`.
 *
 * On the last registration step `Registration` calls `warmAppChunks` when the
 * browser is idle, and a waiting room's button calls `warmClosingDestination`
 * (#1219, #1737). Both `import()` the authenticated app. Against the unbundled
 * dev server that is hundreds of modules, the `@mui/icons-material` barrel
 * among them, and evaluating them blocks the page for 1–3 s. It happens once
 * per document, so it lands in whichever story is running at the time and
 * runs out that story's `findBy*` waits or its 15 s test timeout.
 *
 * Only the two warm-ups are replaced. They put code in the cache and change
 * nothing on screen; every other export, including the loaders behind the lazy
 * screens, stays real (`spy: true`).
 */
vi.mock('../src/components/app/appChunks', { spy: true });
vi.mocked(appChunks.warmAppChunks).mockImplementation(() => undefined);
vi.mocked(appChunks.warmClosingDestination).mockImplementation(() => undefined);
