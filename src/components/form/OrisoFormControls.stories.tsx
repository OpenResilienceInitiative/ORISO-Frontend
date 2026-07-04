import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, Stack, Typography } from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { OrisoMultiSelect, OrisoSelect } from './OrisoSelect';
import { OrisoTextarea } from './OrisoTextarea';

const options = [
	{ value: 'live-chat', label: 'Live Chat' },
	{ value: 'one-to-one', label: '1-1 Beratung' },
	{ value: 'internal', label: 'Internal' },
	{ value: 'supervision', label: 'Supervision' }
];

const meta = {
	title: 'Components/Form/M3Controls',
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'M3 ORISO MUI form controls for select, textarea, and multiselect. These share the same tokens as OrisoTextField.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Select: Story = {
	render: () => {
		const [value, setValue] = React.useState('live-chat');

		return (
			<Box sx={{ width: 280 }}>
				<OrisoSelect
					label="Chat type"
					value={value}
					options={options}
					helperText="Supporting text"
					onChange={(event) => setValue(event.target.value)}
				/>
			</Box>
		);
	}
};

export const SelectError: Story = {
	render: () => (
		<Box sx={{ width: 280 }}>
			<OrisoSelect
				label="Chat type"
				value=""
				options={options}
				error
				helperText="Please select a chat type"
			/>
		</Box>
	)
};

export const Textarea: Story = {
	render: () => {
		const [value, setValue] = React.useState(
			'This is a longer message for the textarea.'
		);

		return (
			<Box sx={{ width: 360 }}>
				<OrisoTextarea
					label="Message"
					value={value}
					minRows={4}
					helperText={`${value.length} / 500`}
					onChange={(event) => setValue(event.target.value)}
					fullWidth
				/>
			</Box>
		);
	}
};

export const TextareaError: Story = {
	render: () => (
		<Box sx={{ width: 360 }}>
			<OrisoTextarea
				label="Message"
				value="Too short"
				minRows={4}
				error
				helperText="Please add more context"
				fullWidth
			/>
		</Box>
	)
};

export const MultiSelect: Story = {
	render: () => {
		const [value, setValue] = React.useState<string[]>([
			'live-chat',
			'internal'
		]);

		const handleChange = (event: SelectChangeEvent<string[]>) => {
			const nextValue = event.target.value;
			setValue(
				typeof nextValue === 'string' ? nextValue.split(',') : nextValue
			);
		};

		return (
			<Box sx={{ width: 360 }}>
				<OrisoMultiSelect
					label="Chat types"
					value={value}
					options={options}
					helperText="Select one or more options"
					onChange={handleChange}
				/>
			</Box>
		);
	}
};

export const StateMatrix: Story = {
	render: () => {
		const [selectValue, setSelectValue] = React.useState('live-chat');
		const [multiValue, setMultiValue] = React.useState<string[]>([
			'live-chat',
			'one-to-one'
		]);
		const [textareaValue, setTextareaValue] =
			React.useState('Textarea input');

		return (
			<Stack spacing={4} sx={{ width: 760 }}>
				<Typography variant="h6">M3 ORISO form controls</Typography>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))',
						gap: '32px 24px'
					}}
				>
					<OrisoSelect
						label="Select"
						value={selectValue}
						options={options}
						helperText="Supporting text"
						onChange={(event) => setSelectValue(event.target.value)}
					/>
					<OrisoSelect
						label="Select error"
						value=""
						options={options}
						error
						helperText="Supporting text"
					/>
					<OrisoTextarea
						label="Textarea"
						value={textareaValue}
						helperText="Supporting text"
						minRows={4}
						onChange={(event) =>
							setTextareaValue(event.target.value)
						}
					/>
					<OrisoMultiSelect
						label="Multiselect"
						value={multiValue}
						options={options}
						helperText="Supporting text"
						onChange={(event) => {
							const nextValue = event.target.value;
							setMultiValue(
								typeof nextValue === 'string'
									? nextValue.split(',')
									: nextValue
							);
						}}
					/>
				</Box>
			</Stack>
		);
	}
};
