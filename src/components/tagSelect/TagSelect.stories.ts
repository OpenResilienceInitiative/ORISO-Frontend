import { Meta, StoryObj } from '@storybook/react';
import { TagSelect } from './TagSelect';

const meta = {
	title: 'Molecules/TagSelect',
	component: TagSelect,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A checkbox-styled selectable tag with a label, used to filter or pick topics.'
			}
		}
	}
} satisfies Meta<typeof TagSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		id: 'tag-anxiety',
		name: 'topics',
		value: 1,
		label: 'Anxiety',
		handleTagSelectClick: () => {}
	}
};

export const LongLabel: Story = {
	args: {
		id: 'tag-relationship',
		name: 'topics',
		value: 2,
		label: 'Relationship & family conflicts',
		handleTagSelectClick: () => {}
	}
};

export const Selected: Story = {
	args: {
		id: 'tag-selected',
		name: 'topics',
		value: 3,
		label: 'Selected topic',
		defaultChecked: true,
		handleTagSelectClick: () => {}
	}
};
