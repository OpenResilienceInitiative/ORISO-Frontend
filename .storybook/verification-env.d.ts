// Resolve the public client export as a module; inherited typeRoots only contains @types.
import 'vite/client';
import type { A11yBaselineEntry } from './a11yBaseline';

declare global {
	interface ImportMetaEnv {
		readonly ORISO_A11Y_CONTROL_PHASE?: 'capture' | 'verify' | null;
		readonly ORISO_A11Y_CONTROL_BASELINES?: A11yBaselineEntry[] | null;
	}
}
