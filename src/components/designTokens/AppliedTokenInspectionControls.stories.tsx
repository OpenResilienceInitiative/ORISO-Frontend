import type { StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import systemMeta, { WithInfoIcon } from '../message/SystemMessage.stories';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';
import { STORYBOOK_SEED } from '../../../.storybook/withOrisoScheme';

// Ordinary browser regressions keep applied-token mismatch detection in CI.
// Reuse the exact SystemMessage CSF component, args and message-shell decorators;
// the normal preview supplies its real palette, MUI, locale and i18n providers.
const meta = {
	...systemMeta,
	id: 'verification-applied-tokens',
	title: 'Verification/Applied tokens',
	tags: ['!autodocs'],
	parameters: { ...systemMeta.parameters, orisoSeed: STORYBOOK_SEED }
};
export default meta;
type Story = StoryObj<typeof meta>;
const mapping = {
	id: 'system.info.fill',
	selector: '.systemMessage__icon path',
	property: 'fill',
	token: '--m3-secondary',
	kind: 'colour' as const,
	source: {
		path: 'src/components/message/message.styles.scss',
		rule: '.systemMessage__icon *',
		declaration: 'fill: var(--m3-secondary, $form-primary)'
	}
};
const inspect = async (root: HTMLElement, mappings = [mapping]) => {
	const { inspectAppliedTokens } = await import('./appliedTokenInspector');
	const rows = inspectAppliedTokens({
		root,
		seeds: { primary: STORYBOOK_SEED },
		scheme: 'light',
		mappings
	});
	// eslint-disable-next-line no-console
	console.info(
		'[applied-token-observation]',
		JSON.stringify({
			viewport: { width: window.innerWidth, height: window.innerHeight },
			rows
		})
	);
	return rows;
};
const target = (root: HTMLElement): SVGPathElement => {
	const node = root.querySelector<SVGPathElement>(mapping.selector);
	if (!node)
		throw new Error('The real SystemMessage info path did not render');
	return node;
};

const expectRealProvider = async (canvasElement: HTMLElement) => {
	await waitFor(async () => {
		const [row] = await inspect(canvasElement);
		expect(row).toMatchObject({
			id: mapping.id,
			status: 'match',
			issues: [],
			source: mapping.source
		});
		expect(row.applied).toBe(getComputedStyle(target(canvasElement)).fill);
		expect(row.expected).toBe(row.calculated);
	});
};
export const RealProviderApplied: Story = {
	...WithInfoIcon,
	globals: { scheme: 'light', locale: 'de' },
	play: async ({ canvasElement }) => expectRealProvider(canvasElement)
};

export const ComponentOverrideThenRestore: Story = {
	...WithInfoIcon,
	globals: { scheme: 'light', locale: 'de' },
	play: async ({ canvasElement }) => {
		await expectRealProvider(canvasElement);
		const node = target(canvasElement);
		const before = node.getAttribute('style');
		const wrong = computeOrisoPalette({ primary: STORYBOOK_SEED }, 'light')
			.tokens['--m3-surface'];
		try {
			node.style.setProperty('fill', wrong, 'important');
			const [row] = await inspect(canvasElement);
			expect(row.issues).toEqual(['applied-mismatch']);
			expect(row.status).toBe('mismatch');
			expect(row.expected).toBe(row.calculated);
		} finally {
			if (before === null) node.removeAttribute('style');
			else node.setAttribute('style', before);
		}
		expect((await inspect(canvasElement))[0].status).toBe('match');
	}
};

export const RootOverrideThenRestore: Story = {
	...WithInfoIcon,
	globals: { scheme: 'light', locale: 'de' },
	play: async ({ canvasElement }) => {
		await expectRealProvider(canvasElement);
		const root = document.documentElement;
		const before = root.style.getPropertyValue(mapping.token);
		const priority = root.style.getPropertyPriority(mapping.token);
		try {
			root.style.setProperty(
				mapping.token,
				computeOrisoPalette({ primary: STORYBOOK_SEED }, 'light')
					.tokens['--m3-surface']
			);
			const [row] = await inspect(canvasElement);
			expect(row.status).toBe('mismatch');
			expect(row.issues).toEqual([
				'calculated-mismatch',
				'applied-mismatch'
			]);
		} finally {
			if (before) root.style.setProperty(mapping.token, before, priority);
			else root.style.removeProperty(mapping.token);
		}
		expect((await inspect(canvasElement))[0].status).toBe('match');
	}
};

export const MissingTarget: Story = {
	...WithInfoIcon,
	globals: { scheme: 'light', locale: 'de' },
	play: async ({ canvasElement }) => {
		const [row] = await inspect(canvasElement, [
			{ ...mapping, selector: '[data-deliberately-missing-token-target]' }
		]);
		expect(row).toMatchObject({
			status: 'missing',
			issues: ['missing-element'],
			applied: null
		});
	}
};

export const StylesheetInterferenceThenRestore: Story = {
	...WithInfoIcon,
	globals: { scheme: 'light', locale: 'de' },
	play: async ({ canvasElement }) => {
		await expectRealProvider(canvasElement);
		const node = target(canvasElement);
		const document = canvasElement.ownerDocument;
		const view = document.defaultView;
		if (!view) throw new Error('The real provider document has no window');
		const expectedRaw = computeOrisoPalette(
			{ primary: STORYBOOK_SEED },
			'light'
		).tokens[mapping.token];
		const beforeFill = view.getComputedStyle(node).fill;
		const beforeStyle = node.getAttribute('style');
		const root = document.documentElement;
		const beforeToken = root.style.getPropertyValue(mapping.token);
		const beforePriority = root.style.getPropertyPriority(mapping.token);
		const beforeBodyChildren = Array.from(document.body.childNodes);
		const interference = document.createElement('style');
		interference.textContent = '* { fill: #010203 !important; }';
		document.head.appendChild(interference);
		try {
			// Prove that real page CSS changed the component, not its engine input.
			expect(view.getComputedStyle(node).fill).toBe('rgb(1, 2, 3)');
			expect(beforeFill).not.toBe('rgb(1, 2, 3)');
			const rows = await inspect(canvasElement);
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				expected: beforeFill,
				calculated: beforeFill,
				applied: 'rgb(1, 2, 3)',
				status: 'mismatch',
				issues: ['applied-mismatch'],
				raw: {
					expected: expectedRaw,
					calculated: expectedRaw,
					applied: 'rgb(1, 2, 3)',
					rootToken: expectedRaw
				}
			});
		} finally {
			interference.remove();
			expect(interference.isConnected).toBe(false);
			expect(Array.from(document.body.childNodes)).toEqual(
				beforeBodyChildren
			);
			expect(node.getAttribute('style')).toBe(beforeStyle);
			expect(root.style.getPropertyValue(mapping.token)).toBe(
				beforeToken
			);
			expect(root.style.getPropertyPriority(mapping.token)).toBe(
				beforePriority
			);
			expect(view.getComputedStyle(node).fill).toBe(beforeFill);
			const restored = await inspect(canvasElement);
			expect(restored).toHaveLength(1);
			expect(restored[0]).toMatchObject({
				status: 'match',
				issues: [],
				expected: beforeFill,
				calculated: beforeFill,
				applied: beforeFill,
				raw: { expected: expectedRaw, calculated: expectedRaw }
			});
			expect(Array.from(document.body.childNodes)).toEqual(
				beforeBodyChildren
			);
		}
	}
};
