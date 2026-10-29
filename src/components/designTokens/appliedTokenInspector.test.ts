import { describe, expect, it } from 'vite-plus/test';

// Decision inputs are synthetic; browser-applied stylesheet proof lives in
// the separate real-provider controls.
const source = {
	path: 'src/components/message/message.styles.scss',
	rule: '.systemMessage__icon *',
	declaration: 'fill: var(--m3-secondary, $form-primary)'
};
const observed = {
	id: 'system.info.fill',
	kind: 'colour' as const,
	token: '--m3-secondary',
	property: 'fill',
	expected: 'rgb(76, 85, 95)',
	calculated: 'rgb(76, 85, 95)',
	applied: 'rgb(76, 85, 95)',
	elementFound: true,
	source
};
const evaluate = async (
	input:
		| typeof observed
		| (Omit<typeof observed, 'expected' | 'calculated' | 'applied'> & {
				expected: string | null;
				calculated: string | null;
				applied: string | null;
		  })
) => {
	const { evaluateAppliedToken } = await import('./appliedTokenInspector');
	return evaluateAppliedToken(input);
};

describe('applied token observation decisions', () => {
	it('accepts equality only when expected, calculated and applied values exist', async () => {
		expect(await evaluate(observed)).toMatchObject({
			status: 'match',
			issues: []
		});
	});
	it('reports a component override although the root token still matches the engine', async () => {
		expect(
			await evaluate({ ...observed, applied: 'rgb(1, 2, 3)' })
		).toMatchObject({
			status: 'mismatch',
			issues: ['applied-mismatch']
		});
	});
	it('reports a root override even when the component follows that wrong root value', async () => {
		expect(
			await evaluate({
				...observed,
				calculated: 'rgb(1, 2, 3)',
				applied: 'rgb(1, 2, 3)'
			})
		).toMatchObject({
			status: 'mismatch',
			issues: ['calculated-mismatch', 'applied-mismatch']
		});
	});
	it('reports a missing target rather than treating two absent values as a match', async () => {
		expect(
			await evaluate({ ...observed, elementFound: false, applied: null })
		).toMatchObject({
			status: 'missing',
			issues: ['missing-element']
		});
	});
	it('reports an empty calculated token without accepting the CSS fallback', async () => {
		expect(await evaluate({ ...observed, calculated: '' })).toMatchObject({
			status: 'missing',
			issues: ['missing-token']
		});
	});
	it('reports unresolved variable syntax without silently normalizing it to a colour', async () => {
		expect(
			await evaluate({ ...observed, calculated: 'var(--undefined)' })
		).toMatchObject({
			status: 'unresolved',
			issues: ['unresolved-token']
		});
	});
	it('does not manufacture an expected value for an unknown engine role', async () => {
		expect(await evaluate({ ...observed, expected: null })).toMatchObject({
			status: 'unresolved',
			issues: ['missing-expected']
		});
	});
	it('retains declared mapping provenance separately from measured values', async () => {
		const result = await evaluate(observed);
		expect(result).toMatchObject({ ...observed, source });
		expect(result.source).not.toHaveProperty('winningRule');
	});
});
