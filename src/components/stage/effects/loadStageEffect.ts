import { StageEffectFactory, StageEffectName } from './types';

/**
 * Fetches the code for exactly one stage effect.
 *
 * This function is the whole answer to "will visitors download four heavy
 * scripts?" — no. Each branch is its own `import()`, so the bundler emits one
 * chunk per effect and only the branch that actually runs is ever requested.
 * The tenant's choice is known before we get here (it comes from the tenant
 * config the app already loads for theming), so we never speculatively fetch.
 *
 * `none` resolves to `null` without touching the network at all.
 *
 * Callers must apply the guards in `useStageEffect` first: this function does
 * not know about viewport, reduced motion or idle time.
 */
export const loadStageEffect = async (
	name: StageEffectName
): Promise<StageEffectFactory | null> => {
	switch (name) {
		case 'lines':
			return (await import('./variants/lines')).createLinesEffect;
		case 'connectedDots':
			return (await import('./variants/connectedDots'))
				.createConnectedDotsEffect;
		case 'cracks':
			return (await import('./variants/cracks')).createCracksEffect;
		case 'none':
		default:
			return null;
	}
};
