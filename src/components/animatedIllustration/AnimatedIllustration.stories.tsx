import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { Box } from '@mui/material';
import { EmptyState } from '../emptyState/EmptyState';
import { SearchEmptyStateAnimation } from '../emptyState/SearchEmptyStateAnimation';
import { CheckAnimation, EmailSentAnimation } from './AnimatedIllustration';

const meta = {
	title: 'Molecules/AnimatedIllustration',
	tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThemedIllustrations: Story = {
	name: 'Platzhalter und Bestätigungen',
	render: () => (
		<Box
			sx={{
				display: 'grid',
				gridTemplateColumns:
					'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
				alignItems: 'center',
				gap: 1
			}}
		>
			<EmptyState headline="Keine Anfragen" variant="inquiry" />
			<EmptyState headline="Keine Gespräche" variant="no-conversations" />
			<EmptyState headline="Das Archiv ist leer" variant="archive" />
			<EmptyState
				headline="Noch kein Verlauf"
				variant="conversation-history"
			/>
			<EmptyState
				headline="Aktuell nichts zu tun"
				variant="conversation-nothing-to-do"
			/>
			<Box className="emptyState">
				<SearchEmptyStateAnimation />
				<p className="emptyState__headline">Keine Treffer</p>
			</Box>
			<Box className="emptyState">
				<Box sx={{ width: 176, height: 176 }}>
					<CheckAnimation />
				</Box>
				<p className="emptyState__headline">Bestätigt</p>
			</Box>
			<Box className="emptyState">
				<Box sx={{ width: 176, height: 176 }}>
					<EmailSentAnimation />
				</Box>
				<p className="emptyState__headline">E-Mail versendet</p>
			</Box>
		</Box>
	),
	play: async ({ canvasElement }) => {
		const reduced = window.matchMedia(
			'(prefers-reduced-motion: reduce)'
		).matches;
		await waitFor(
			() => {
				const illustrations = Array.from(
					canvasElement.querySelectorAll(
						'[data-animated-illustration]'
					)
				);
				expect(illustrations).toHaveLength(8);
				for (const illustration of illustrations) {
					const svg = illustration.matches('svg')
						? illustration
						: illustration.querySelector('svg');
					expect(svg?.querySelector('path')).toBeTruthy();
					if (reduced)
						expect(
							illustration.getAttribute('data-complete')
						).not.toBe('true');
				}
			},
			{ timeout: 6000 }
		);
	}
};
