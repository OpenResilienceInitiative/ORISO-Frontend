import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
import { Box, BoxTypes } from './Box';
import styles from './box.module.scss';

const meta = {
	title: 'Atoms/Box',
	component: Box,
	tags: ['autodocs'],
	parameters: {
		// #1338: the box keeps its designed colours: the info text (#ff9f00 on
		// #fcf9f9, 1.96:1) and the title on the success (#0a882f, 4.19:1) and
		// error (#b1005e, 2.9:1) fills. Only they leave the colour-contrast
		// audit.
		a11y: a11yExcept({
			'color-contrast': [
				`.${styles.box__title}`,
				`.${styles['box--info']} .${styles.box__content} > span`
			]
		}),
		docs: {
			description: {
				component:
					'Box component for displaying titled content blocks with error, info and success variants.'
			}
		}
	}
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
	args: {
		children: <span>This is an informational message.</span>
	},
	render: () => (
		<Box title="Information" type={BoxTypes.INFO}>
			<span>This is an informational message.</span>
		</Box>
	)
};

export const Success: Story = {
	args: {
		children: <span>Your changes have been saved.</span>
	},
	render: () => (
		<Box title="Success" type={BoxTypes.SUCCESS}>
			<span>Your changes have been saved.</span>
		</Box>
	)
};

export const Error: Story = {
	args: {
		children: <span>Something went wrong.</span>
	},
	render: () => (
		<Box title="Error" type={BoxTypes.ERROR}>
			<span>Something went wrong.</span>
		</Box>
	)
};

export const NoTitle: Story = {
	args: {
		children: <span>A plain box without a title or type.</span>
	},
	render: () => (
		<Box>
			<span>A plain box without a title or type.</span>
		</Box>
	)
};
