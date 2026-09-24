import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AnimalAvatar, iconPaddingFor } from './AnimalAvatar';
import { pickIconColor } from '../../utils/pseudonymGenerator';

const meta: Meta<typeof AnimalAvatar> = {
	title: 'Pseudonym/Atoms/AnimalAvatar',
	component: AnimalAvatar
};

export default meta;
type Story = StoryObj<typeof AnimalAvatar>;

const animal = (file: string, bg: string) => ({
	file,
	bg,
	iconColor: pickIconColor(bg)
});

/** Round faces on the 16% default beside the motifs with an optical override. */
const ROW = [
	animal('alpaca.svg', '#FCE7E6'),
	animal('bear.svg', '#BBBCDE'),
	animal('cat.svg', '#1F3134'),
	animal('dolphin.svg', '#6E2A3A'),
	animal('Nightingale.svg', '#FCE7E6'),
	animal('owl.svg', '#D6E9CA'),
	animal('giraffe.svg', '#BBBCDE'),
	animal('turtle.svg', '#F0DC82'),
	animal('zebra.svg', '#1F3134')
];

const Row = ({ size }: { size: number }) => (
	<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
		{ROW.map((avatar) => (
			<figure
				key={avatar.file}
				style={{ margin: 0, textAlign: 'center' }}
			>
				<AnimalAvatar avatar={avatar} size={size} />
				<figcaption style={{ fontSize: 12 }}>
					{avatar.file.replace('.svg', '')}{' '}
					{Math.round(iconPaddingFor(avatar.file) * 100)}%
				</figcaption>
			</figure>
		))}
	</div>
);

/**
 * Per-icon padding (#1561): every animal should read about as large as its
 * neighbours. The caption shows each motif's padding share.
 */
export const OpticalPadding: Story = {
	render: () => (
		<div style={{ display: 'grid', gap: 24 }}>
			<Row size={104} />
			<Row size={40} />
		</div>
	)
};
