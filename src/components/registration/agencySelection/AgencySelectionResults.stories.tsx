import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
	effectiveBackground,
	wcagContrast
} from '../../../utils/theme/wcagContrast';
import { AgencySelectionResults } from './AgencySelectionResults';
import type { AgencyDataInterface } from '../../../globalState/interfaces';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

/**
 * The two informational states of the agency step. Both used to be a
 * wrap-reverse flex whose text column shrank to min-content on phones and
 * broke words mid-syllable; they are a grid now — mobile order headline,
 * icon centred, copy, full-width button.
 */
const meta = {
	title: 'REGISTRATION/AgencySelection/Results',
	component: AgencySelectionResults,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		}
	},
	args: {
		onChange: () => {},
		zipcode: '50667',
		nextStepUrl: '/registration/next',
		fallbackUrl: '',
		onNextClick: () => {}
	}
} satisfies Meta<typeof AgencySelectionResults>;

export default meta;
type Story = StoryObj<typeof AgencySelectionResults>;

const baseAgency = {
	city: 'Köln',
	consultingType: 1,
	description: '',
	offline: false,
	postcode: '50667'
} as const;

export const NoResults: Story = {
	name: 'Keine Online-Beratungsstelle gefunden',
	args: { results: [] }
};

export const OnlyExternal: Story = {
	name: 'Nur externe Beratungsstellen',
	args: {
		results: [
			{
				id: 9901,
				name: 'Beratungsstelle Musterstadt',
				external: true,
				url: 'https://example.org/beratung'
			} as AgencyDataInterface
		]
	}
};

const checkDarkHighContrast: NonNullable<Story['play']> = async ({
	canvasElement
}) => {
	const canvas = within(canvasElement);
	const heading = canvas.getByRole('heading', { level: 5 });
	const card = heading.parentElement;
	if (!card) throw new Error('The result heading has no card');
	const description = within(card).getByRole('paragraph');
	const action = within(card).getByRole('link');

	await waitFor(() => {
		const root = canvasElement.ownerDocument.documentElement;
		expect(root.dataset.orisoPersonalScheme).toBe('dark');
		expect(root.dataset.orisoContrastLevel).toBe('high');
		for (const text of [heading, description, action]) {
			const { color, fontSize, fontWeight } = getComputedStyle(text);
			const size = Number.parseFloat(fontSize);
			const largeText =
				size >= 24 ||
				(size >= (14 * 4) / 3 && Number(fontWeight) >= 700);
			expect(
				wcagContrast(color, effectiveBackground(text)),
				text.textContent ?? ''
			).toBeGreaterThanOrEqual(largeText ? 4.5 : 7);
		}
	});
};

export const NoResultsDarkHigh: Story = {
	...NoResults,
	name: 'Keine Online-Beratungsstelle gefunden · Dunkel und Hoch',
	globals: { scheme: 'dark', contrast: 'high' },
	play: async (context) => {
		await checkDarkHighContrast(context);
		await waitFor(
			() => {
				const artwork = context.canvasElement.querySelector(
					'[data-animated-illustration="search"] svg'
				);
				expect(artwork?.querySelector('path')).toBeTruthy();
			},
			{ timeout: 6000 }
		);
	}
};

export const OnlyExternalDarkHigh: Story = {
	...OnlyExternal,
	name: 'Nur externe Beratungsstellen · Dunkel und Hoch',
	globals: { scheme: 'dark', contrast: 'high' },
	play: checkDarkHighContrast
};

export const TeamAndSingle: Story = {
	name: 'Team- und Einzelberatung Labels',
	args: {
		results: [
			{
				...baseAgency,
				id: 1,
				name: 'Teamberatung Innenstadt',
				teamAgency: true
			},
			{
				...baseAgency,
				id: 2,
				name: 'Einzelberatung Ehrenfeld',
				teamAgency: false
			},
			{
				...baseAgency,
				id: 3,
				name: 'Beratung ohne Typ-Flag (Single-Fallback)'
			}
		] as AgencyDataInterface[]
	}
};
