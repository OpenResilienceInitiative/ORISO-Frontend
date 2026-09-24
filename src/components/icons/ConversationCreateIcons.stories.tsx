import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { conversationCreateIconCatalog } from './conversationCreateIcons';
import './conversationCreateIcons.styles.scss';

const meta = {
	title: 'Foundations/Icons/Conversation Create',
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Zentraler Katalog der wiederverwendbaren Gesprächskreis-Icons. 400 bezeichnet die Outline-/Ruhevariante, Filled den ausgewählten Zustand.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
	render: () => (
		<div className="conversationCreateIconCatalog">
			{conversationCreateIconCatalog.map(({ name, weight, Icon }) => (
				<figure
					className="conversationCreateIconCatalog__item"
					key={`${name}-${weight}`}
				>
					<div className="conversationCreateIconCatalog__glyph">
						<Icon aria-hidden />
					</div>
					<figcaption>
						<strong>{name}</strong>
						<span>{weight}</span>
					</figcaption>
				</figure>
			))}
		</div>
	)
};
