import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgencySelectionResults } from './AgencySelectionResults';
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
			} as any
		]
	}
};
