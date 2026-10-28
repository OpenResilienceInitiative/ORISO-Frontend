import { canonical, createA11yBaselineGate } from './a11yBaseline';
import { approvedA11yBaselines } from './a11yBaselines';

const styles = (target: unknown) => {
	if (
		!Array.isArray(target) ||
		target.some((selector) => typeof selector !== 'string')
	)
		throw new Error(
			'Accessibility audit unsupported node target; explicit review required'
		);
	return target.map((selector) => {
		const element = document.querySelector(selector);
		if (!element)
			throw new Error(
				`Accessibility audit target disappeared before verification: ${selector}`
			);
		const chain = [];
		for (
			let node: Element | null = element;
			node;
			node = node.parentElement
		) {
			const computed = getComputedStyle(node);
			chain.push(
				Object.fromEntries(
					[
						'color',
						'background-color',
						'opacity',
						'font-size',
						'font-weight',
						'font-family',
						'text-shadow',
						'visibility',
						'display'
					].map((name) => [name, computed.getPropertyValue(name)])
				)
			);
		}
		return chain;
	});
};

// Test-only injected entries are possible exclusively in the isolated controls
// project. Ordinary runs consume only the reviewed source-owned approvals.
export const a11yVerification = createA11yBaselineGate({
	entries:
		import.meta.env.ORISO_A11Y_CONTROL_BASELINES ?? approvedA11yBaselines,
	environment: (context) =>
		canonical({
			contract: 'frontend-story-fixtures-v1',
			browser: navigator.userAgent,
			locale: navigator.language,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			viewport: [
				window.innerWidth,
				window.innerHeight,
				window.devicePixelRatio
			],
			globals: context.globals,
			fixture: {
				context:
					context.parameters.verification?.a11yContext ?? 'default',
				seed: context.parameters.orisoSeed ?? '#A5000A',
				router: context.parameters.router ?? null
			},
			audit: {
				options: context.parameters.a11y?.options,
				config: context.parameters.a11y?.config,
				context: context.parameters.a11y?.context
			}
		}),
	styles,
	today: () => new Date().toISOString().slice(0, 10)
});
