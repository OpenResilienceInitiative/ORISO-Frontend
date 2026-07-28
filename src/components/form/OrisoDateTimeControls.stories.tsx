import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import dayjs, { Dayjs } from 'dayjs';
import { Box, Stack, Typography } from '@mui/material';
import { OrisoCalendar } from './OrisoCalendar';
import { OrisoDatePicker } from './OrisoDatePicker';
import { OrisoTimePicker } from './OrisoTimePicker';

const meta = {
	title: 'Components/Form/M3DateTime',
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'M3 ORISO date and time components: standalone calendar, docked date picker and time picker (dial + keyboard input). They share the same tokens as OrisoTextField and the other M3 form controls.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const CalendarStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(dayjs());

	return <OrisoCalendar value={value} onChange={setValue} />;
};

const CalendarMinMaxStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(dayjs());

	return (
		<OrisoCalendar
			value={value}
			onChange={setValue}
			minDate={dayjs().subtract(7, 'day')}
			maxDate={dayjs().add(30, 'day')}
		/>
	);
};

const DatePickerStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(null);

	return (
		<Box sx={{ width: 280 }}>
			<OrisoDatePicker
				label="Date"
				value={value}
				helperText="DD.MM.YYYY"
				onChange={setValue}
			/>
		</Box>
	);
};

const DatePickerMinMaxStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(dayjs());

	return (
		<Box sx={{ width: 280 }}>
			<OrisoDatePicker
				label="Appointment date"
				value={value}
				helperText="Within the next 30 days"
				minDate={dayjs()}
				maxDate={dayjs().add(30, 'day')}
				onChange={setValue}
			/>
		</Box>
	);
};

const TimePickerStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(null);

	return (
		<Box sx={{ width: 280 }}>
			<OrisoTimePicker
				label="Time"
				value={value}
				helperText="hh:mm"
				onChange={setValue}
			/>
		</Box>
	);
};

const TimePicker24hStory = () => {
	const [value, setValue] = React.useState<Dayjs | null>(
		dayjs().hour(14).minute(30)
	);

	return (
		<Box sx={{ width: 280 }}>
			<OrisoTimePicker
				label="Time (24h)"
				value={value}
				ampm={false}
				helperText="HH:mm"
				onChange={setValue}
			/>
		</Box>
	);
};

const StateMatrixStory = () => {
	const [date, setDate] = React.useState<Dayjs | null>(dayjs());
	const [time, setTime] = React.useState<Dayjs | null>(
		dayjs().hour(9).minute(15)
	);
	const [calendarValue, setCalendarValue] = React.useState<Dayjs | null>(
		dayjs()
	);

	return (
		<Stack spacing={4} sx={{ width: 760 }}>
			<Typography variant="h6">
				M3 ORISO date and time controls
			</Typography>
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))',
					gap: '32px 24px'
				}}
			>
				<OrisoDatePicker
					label="Date"
					value={date}
					helperText="Supporting text"
					onChange={setDate}
				/>
				<OrisoDatePicker
					label="Date error"
					value={null}
					error
					helperText="Please select a date"
				/>
				<OrisoTimePicker
					label="Time"
					value={time}
					helperText="Supporting text"
					onChange={setTime}
				/>
				<OrisoTimePicker
					label="Time disabled"
					value={null}
					disabled
					helperText="Supporting text"
				/>
			</Box>
			<Box sx={{ display: 'flex', justifyContent: 'center' }}>
				<OrisoCalendar
					value={calendarValue}
					onChange={setCalendarValue}
				/>
			</Box>
		</Stack>
	);
};

export const Calendar: Story = {
	render: () => <CalendarStory />
};

export const CalendarMinMax: Story = {
	render: () => <CalendarMinMaxStory />
};

export const DatePicker: Story = {
	render: () => <DatePickerStory />
};

export const DatePickerMinMax: Story = {
	render: () => <DatePickerMinMaxStory />
};

export const DatePickerError: Story = {
	render: () => (
		<Box sx={{ width: 280 }}>
			<OrisoDatePicker
				label="Date"
				value={null}
				error
				helperText="Please select a date"
			/>
		</Box>
	)
};

export const TimePicker: Story = {
	render: () => <TimePickerStory />
};

export const TimePicker24h: Story = {
	render: () => <TimePicker24hStory />
};

export const StateMatrix: Story = {
	render: () => <StateMatrixStory />
};
