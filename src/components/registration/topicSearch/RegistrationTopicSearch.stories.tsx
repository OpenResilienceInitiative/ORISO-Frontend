import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button } from '@mui/material';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { RegistrationTopicSearch } from './RegistrationTopicSearch';
import { buildTopicSearchIndex } from './topicSearchEngine';
import { buildTopicSearchDocuments } from './topicSearchDocuments';
import { topicSearchCatalog } from './topicSearchCatalog.generated';
import { getRegistrationTopicIcon } from '../registrationDesign/registrationDesign';

const keys = Object.keys(topicSearchCatalog.topics);
const entries = keys.map((key, id) => ({
	topicId: id,
	title: topicSearchCatalog.topics[key].de.title,
	icon: getRegistrationTopicIcon({ slug: key, internalIdentifier: '' })
}));
const index = buildTopicSearchIndex(
	buildTopicSearchDocuments(keys.map((key, id) => ({ id, key })))
);

/** The desktop header row: search · language · login, right-aligned. */
const HeaderRow = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			display: 'flex',
			justifyContent: 'flex-end',
			alignItems: 'flex-start',
			gap: 1,
			px: 3,
			pt: 1.5,
			bgcolor: 'var(--m3-background, #fcf9f9)',
			minHeight: 420
		}}
	>
		{children}
		<Button
			variant="outlined"
			sx={{ borderRadius: 999, minHeight: 48, px: 2.5 }}
		>
			Deutsch DE
		</Button>
		<Button
			variant="outlined"
			sx={{ borderRadius: 999, minHeight: 48, px: 2.75 }}
		>
			Einloggen
		</Button>
	</Box>
);

const meta = {
	title: 'REGISTRATION/Topic search (header)',
	component: RegistrationTopicSearch,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Magnifier in the registration header, next to language and login. Opened it grows into a search field with Google-style suggestions. It matches topic titles and descriptions in every shipped language plus everyday related words (trigram vectors, typo-tolerant, runs on the device). Picking a suggestion selects that topic in the list, then "Weiter" works as usual.'
			}
		}
	},
	args: { entries, index, onSelect: fn() },
	render: (args) => (
		<HeaderRow>
			<RegistrationTopicSearch {...args} />
		</HeaderRow>
	)
} satisfies Meta<typeof RegistrationTopicSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const RelatedWord: Story = {
	args: { defaultOpen: true, defaultQuery: 'alkohol' }
};

export const TypingWithTypo: Story = {
	args: { defaultOpen: true, defaultQuery: 'schwangerschft' }
};

export const OtherLanguage: Story = {
	args: { defaultOpen: true, defaultQuery: 'зависимость' }
};

export const NoResults: Story = {
	args: { defaultOpen: true, defaultQuery: 'qqqxxz' }
};

export const MobileBar: Story = {
	args: { tone: 'onPrimary' },
	parameters: { viewport: { defaultViewport: 'mobile1' } },
	render: (args) => (
		<Box sx={{ minHeight: 420 }}>
			<Box
				sx={{
					position: 'relative',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					px: 2.5,
					py: 1.75,
					color: '#fff',
					background:
						'radial-gradient(120% 90% at 78% 8%, #e0313b 0%, #a5000a 42%, #8c0e17 78%)'
				}}
			>
				<b>Beratung &amp; Hilfe</b>
				<RegistrationTopicSearch {...args} />
			</Box>
		</Box>
	)
};

export const OpenTypePick: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole('button', { name: 'Thema suchen' })
		);
		const input = await canvas.findByRole('combobox');
		await userEvent.type(input, 'mahnung');

		const option = await body.findByRole('option', { name: /Schulden/ });
		await expect(option).toHaveTextContent('passt zu „Mahnung“');
		await userEvent.click(option);

		await waitFor(() =>
			expect(args.onSelect).toHaveBeenCalledWith(keys.indexOf('debt'))
		);
		await expect(
			canvas.getByRole('button', { name: 'Thema suchen' })
		).toBeInTheDocument();
	}
};
