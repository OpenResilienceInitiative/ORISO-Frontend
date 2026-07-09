import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
	Box,
	IconButton,
	InputAdornment,
	Stack,
	Typography
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { OrisoTextField } from './OrisoTextField';
import { orisoInputColors } from './orisoInputDesign';

const meta = {
	title: 'Components/Form/OrisoTextField',
	component: OrisoTextField,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'M3 ORISO text field based on MUI TextField. Matches the Design System M3 ORISO outlined text field states, helper text, and icon spacing.'
			}
		},
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=52798-24373'
		}
	}
} satisfies Meta<typeof OrisoTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const fieldWidth = 260;

export const Enabled: Story = {
	args: {
		label: 'Label',
		value: 'Input',
		helperText: 'Supporting text',
		fullWidth: true
	},
	decorators: [
		(Story) => (
			<Box sx={{ width: fieldWidth }}>
				<Story />
			</Box>
		)
	]
};

export const Placeholder: Story = {
	args: {
		label: 'Label',
		placeholder: 'Placeholder',
		helperText: 'Supporting text',
		fullWidth: true
	},
	decorators: Enabled.decorators
};

export const Focused: Story = {
	args: {
		label: 'Label',
		value: 'Input',
		helperText: 'Supporting text',
		focused: true,
		fullWidth: true
	},
	decorators: Enabled.decorators
};

export const Error: Story = {
	args: {
		label: 'Label',
		value: 'Input',
		error: true,
		helperText: 'Supporting text',
		fullWidth: true,
		InputProps: {
			endAdornment: (
				<InputAdornment position="end">
					<ErrorIcon sx={{ color: orisoInputColors.error }} />
				</InputAdornment>
			)
		}
	},
	decorators: Enabled.decorators
};

export const Disabled: Story = {
	args: {
		label: 'Label',
		value: 'Input',
		helperText: 'Supporting text',
		disabled: true,
		fullWidth: true
	},
	decorators: Enabled.decorators
};

export const WithLeadingIcon: Story = {
	args: {
		label: 'Username',
		value: 'shanzae',
		helperText: 'Supporting text',
		fullWidth: true,
		InputProps: {
			startAdornment: (
				<InputAdornment position="start">
					<PersonOutlineIcon
						sx={{ color: orisoInputColors.onSurfaceVariant }}
					/>
				</InputAdornment>
			)
		}
	},
	decorators: Enabled.decorators
};

export const WithLeadingAndTrailingIcon: Story = {
	args: {
		label: 'Password',
		value: 'secret',
		type: 'password',
		helperText: 'Supporting text',
		fullWidth: true,
		InputProps: {
			startAdornment: (
				<InputAdornment position="start">
					<SearchIcon
						sx={{ color: orisoInputColors.onSurfaceVariant }}
					/>
				</InputAdornment>
			),
			endAdornment: (
				<InputAdornment position="end">
					<IconButton aria-label="Show password" edge="end">
						<VisibilityIcon
							sx={{
								color: orisoInputColors.onSurfaceVariant
							}}
						/>
					</IconButton>
				</InputAdornment>
			)
		}
	},
	decorators: Enabled.decorators
};

export const StateMatrix: Story = {
	render: () => (
		<Stack spacing={4} sx={{ width: 620 }}>
			<Typography variant="h6">Outlined text field states</Typography>
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
					gap: '32px 24px'
				}}
			>
				<OrisoTextField
					label="Enabled"
					value="Input"
					helperText="Supporting text"
				/>
				<OrisoTextField
					label="Focused"
					value="Input"
					helperText="Supporting text"
					focused
				/>
				<OrisoTextField
					label="Error"
					value="Input"
					error
					helperText="Supporting text"
					InputProps={{
						endAdornment: (
							<InputAdornment position="end">
								<ErrorIcon
									sx={{ color: orisoInputColors.error }}
								/>
							</InputAdornment>
						)
					}}
				/>
				<OrisoTextField
					label="Disabled"
					value="Input"
					helperText="Supporting text"
					disabled
				/>
			</Box>
		</Stack>
	)
};
