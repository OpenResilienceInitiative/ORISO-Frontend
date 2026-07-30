import * as React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
	Box,
	Button,
	ButtonBase,
	Dialog,
	IconButton,
	InputAdornment,
	InputBase,
	Typography
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import { OrisoTextField } from './OrisoTextField';
import {
	orisoDateTimeColors,
	orisoPickerTypography,
	orisoTimePickerDialogSx
} from './orisoDateTimeDesign';

dayjs.extend(customParseFormat);

export interface OrisoTimePickerProps {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
	/** 12-hour clock with AM/PM selector; set false for 24-hour. */
	ampm?: boolean;
	helperText?: React.ReactNode;
	error?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	dialogTitle?: string;
	cancelLabel?: string;
	okLabel?: string;
	placeholder?: string;
	id?: string;
	/**
	 * Render a custom trigger instead of the text field and keep the dial
	 * dialog as-is — used by the create-conversation settings rows, whose
	 * trigger is a split button rather than an input.
	 */
	renderTrigger?: (openDialog: () => void) => React.ReactNode;
}

const DIAL_SIZE = 256;
const NUMBER_SIZE = 48;
const OUTER_RADIUS = DIAL_SIZE / 2 - NUMBER_SIZE / 2 - 4;
const INNER_RADIUS = OUTER_RADIUS - 36;

const timeFieldSx = {
	'width': '96px',
	'height': '80px',
	'borderRadius': '8px',
	'display': 'flex',
	'alignItems': 'center',
	'justifyContent': 'center',
	'backgroundColor': orisoDateTimeColors.surfaceContainerHighest,
	'color': orisoDateTimeColors.onSurface,
	...orisoPickerTypography.displayLarge,
	'&.orisoTimeField--active': {
		backgroundColor: orisoDateTimeColors.primaryContainer,
		color: orisoDateTimeColors.onPrimaryContainer
	}
} as const;

const meridiemButtonSx = {
	'flex': 1,
	'width': '100%',
	'color': orisoDateTimeColors.onSurfaceVariant,
	...orisoPickerTypography.labelLarge,
	'&.orisoMeridiem--selected': {
		backgroundColor: orisoDateTimeColors.primaryContainer,
		color: orisoDateTimeColors.onPrimaryContainer
	}
} as const;

const actionButtonSx = {
	color: orisoDateTimeColors.primary,
	textTransform: 'none',
	borderRadius: '20px',
	padding: '10px 12px',
	...orisoPickerTypography.labelLarge
} as const;

const pad = (num: number) => String(num).padStart(2, '0');

const toDisplayHour = (hour24: number, ampm: boolean) => {
	if (!ampm) {
		return hour24;
	}
	const hour = hour24 % 12;
	return hour === 0 ? 12 : hour;
};

interface DialProps {
	selecting: 'hour' | 'minute';
	hour24: number;
	minute: number;
	ampm: boolean;
	onSelectHour: (hour24: number) => void;
	onSelectMinute: (minute: number) => void;
	onHourSelected: () => void;
}

const OrisoTimeDial = ({
	selecting,
	hour24,
	minute,
	ampm,
	onSelectHour,
	onSelectMinute,
	onHourSelected
}: DialProps) => {
	const dialRef = React.useRef<HTMLDivElement>(null);
	const isDragging = React.useRef(false);

	const positionFor = (angleDeg: number, radius: number) => {
		const radians = (angleDeg * Math.PI) / 180;
		return {
			left: DIAL_SIZE / 2 + radius * Math.sin(radians) - NUMBER_SIZE / 2,
			top: DIAL_SIZE / 2 - radius * Math.cos(radians) - NUMBER_SIZE / 2
		};
	};

	const applyPointer = (clientX: number, clientY: number) => {
		const rect = dialRef.current?.getBoundingClientRect();
		if (!rect) {
			return;
		}
		const dx = clientX - rect.left - DIAL_SIZE / 2;
		const dy = clientY - rect.top - DIAL_SIZE / 2;
		const distance = Math.sqrt(dx * dx + dy * dy);
		let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
		if (angle < 0) {
			angle += 360;
		}

		if (selecting === 'minute') {
			onSelectMinute(Math.round(angle / 6) % 60);
			return;
		}

		const position = Math.round(angle / 30) % 12;
		if (ampm) {
			const hour = position === 0 ? 12 : position;
			const meridiemOffset = hour24 >= 12 ? 12 : 0;
			onSelectHour((hour % 12) + meridiemOffset);
			return;
		}

		const isInnerRing = distance < (OUTER_RADIUS + INNER_RADIUS) / 2;
		if (isInnerRing) {
			onSelectHour(position === 0 ? 0 : position + 12);
		} else {
			onSelectHour(position === 0 ? 12 : position);
		}
	};

	const selectedAngle =
		selecting === 'minute' ? minute * 6 : (hour24 % 12) * 30;
	const selectedRadius =
		selecting === 'hour' && !ampm && (hour24 === 0 || hour24 > 12)
			? INNER_RADIUS
			: OUTER_RADIUS;

	const numbers: {
		label: string;
		angle: number;
		radius: number;
		isSelected: boolean;
		value: number;
	}[] = [];

	if (selecting === 'minute') {
		for (let index = 0; index < 12; index++) {
			const minuteValue = index * 5;
			numbers.push({
				label: pad(minuteValue),
				angle: minuteValue * 6,
				radius: OUTER_RADIUS,
				isSelected: minute === minuteValue,
				value: minuteValue
			});
		}
	} else {
		for (let index = 0; index < 12; index++) {
			const hour = index === 0 ? 12 : index;
			const hourValue = ampm
				? (hour % 12) + (hour24 >= 12 ? 12 : 0)
				: hour;
			numbers.push({
				label: String(hour),
				angle: index * 30,
				radius: OUTER_RADIUS,
				isSelected: hour24 === hourValue,
				value: hourValue
			});
		}
		if (!ampm) {
			for (let index = 0; index < 12; index++) {
				const hourValue = index === 0 ? 0 : index + 12;
				numbers.push({
					label: pad(hourValue),
					angle: index * 30,
					radius: INNER_RADIUS,
					isSelected: hour24 === hourValue,
					value: hourValue
				});
			}
		}
	}

	return (
		<Box
			ref={dialRef}
			onPointerDown={(event) => {
				isDragging.current = true;
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch {
					// synthetic pointer events have no active pointer to capture
				}
				applyPointer(event.clientX, event.clientY);
			}}
			onPointerMove={(event) => {
				if (isDragging.current) {
					applyPointer(event.clientX, event.clientY);
				}
			}}
			onPointerUp={() => {
				isDragging.current = false;
				if (selecting === 'hour') {
					onHourSelected();
				}
			}}
			sx={{
				position: 'relative',
				width: `${DIAL_SIZE}px`,
				height: `${DIAL_SIZE}px`,
				borderRadius: '50%',
				backgroundColor: orisoDateTimeColors.surfaceContainerHighest,
				touchAction: 'none',
				cursor: 'pointer',
				userSelect: 'none',
				margin: '0 auto'
			}}
		>
			<Box
				sx={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					width: '8px',
					height: '8px',
					marginLeft: '-4px',
					marginTop: '-4px',
					borderRadius: '50%',
					backgroundColor: orisoDateTimeColors.primary
				}}
			/>
			<Box
				sx={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					width: '2px',
					height: `${selectedRadius}px`,
					marginLeft: '-1px',
					backgroundColor: orisoDateTimeColors.primary,
					transformOrigin: 'top center',
					transform: `rotate(${selectedAngle + 180}deg)`
				}}
			/>
			{numbers.map((number) => {
				const { left, top } = positionFor(number.angle, number.radius);
				return (
					<Box
						key={`${number.radius}-${number.label}`}
						sx={{
							position: 'absolute',
							left: `${left}px`,
							top: `${top}px`,
							width: `${NUMBER_SIZE}px`,
							height: `${NUMBER_SIZE}px`,
							borderRadius: '50%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							pointerEvents: 'none',
							...orisoPickerTypography.bodyLarge,
							color: number.isSelected
								? orisoDateTimeColors.onPrimary
								: number.radius === INNER_RADIUS
									? orisoDateTimeColors.onSurfaceVariant
									: orisoDateTimeColors.onSurface,
							backgroundColor: number.isSelected
								? orisoDateTimeColors.primary
								: 'transparent'
						}}
					>
						{number.label}
					</Box>
				);
			})}
		</Box>
	);
};

export const OrisoTimePicker = ({
	label,
	value,
	onChange,
	ampm = true,
	helperText,
	error,
	disabled,
	fullWidth = true,
	dialogTitle = 'Select time',
	cancelLabel = 'Cancel',
	okLabel = 'OK',
	placeholder,
	id,
	renderTrigger
}: OrisoTimePickerProps) => {
	const displayFormat = ampm ? 'hh:mm A' : 'HH:mm';
	const parseFormats = ampm
		? ['hh:mm A', 'h:mm A', 'HH:mm', 'H:mm']
		: ['HH:mm', 'H:mm'];

	const [open, setOpen] = React.useState(false);
	const [mode, setMode] = React.useState<'dial' | 'input'>('dial');
	const [selecting, setSelecting] = React.useState<'hour' | 'minute'>('hour');
	const [hour24, setHour24] = React.useState(12);
	const [minute, setMinute] = React.useState(0);
	const [inputText, setInputText] = React.useState(
		value ? value.format(displayFormat) : ''
	);

	React.useEffect(() => {
		setInputText(value ? value.format(displayFormat) : '');
	}, [value, displayFormat]);

	const openDialog = () => {
		const base = value ?? dayjs().hour(12).minute(0);
		setHour24(base.hour());
		setMinute(base.minute());
		setSelecting('hour');
		setMode('dial');
		setOpen(true);
	};

	const handleOk = () => {
		const base = value ?? dayjs();
		onChange?.(base.hour(hour24).minute(minute).second(0));
		setOpen(false);
	};

	const commitInput = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) {
			onChange?.(null);
			return;
		}
		const parsed = dayjs(trimmed, parseFormats, true);
		if (parsed.isValid()) {
			const base = value ?? dayjs();
			onChange?.(
				base.hour(parsed.hour()).minute(parsed.minute()).second(0)
			);
		} else {
			setInputText(value ? value.format(displayFormat) : '');
		}
	};

	const meridiem: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';

	const setMeridiem = (next: 'AM' | 'PM') => {
		if (next === 'AM' && hour24 >= 12) {
			setHour24(hour24 - 12);
		}
		if (next === 'PM' && hour24 < 12) {
			setHour24(hour24 + 12);
		}
	};

	const displayHour = toDisplayHour(hour24, ampm);

	const handleHourInput = (text: string) => {
		const digits = text.replace(/\D/g, '').slice(0, 2);
		if (!digits) {
			return;
		}
		const parsed = Number(digits);
		if (ampm) {
			if (parsed >= 1 && parsed <= 12) {
				setHour24((parsed % 12) + (meridiem === 'PM' ? 12 : 0));
			}
		} else if (parsed >= 0 && parsed <= 23) {
			setHour24(parsed);
		}
	};

	const handleMinuteInput = (text: string) => {
		const digits = text.replace(/\D/g, '').slice(0, 2);
		if (!digits) {
			return;
		}
		const parsed = Number(digits);
		if (parsed >= 0 && parsed <= 59) {
			setMinute(parsed);
		}
	};

	const timeInputSx = {
		...timeFieldSx,
		'& .MuiInputBase-input': {
			textAlign: 'center',
			padding: 0,
			height: '100%',
			...orisoPickerTypography.displayLarge
		}
	} as const;

	return (
		<>
			{renderTrigger ? (
				renderTrigger(openDialog)
			) : (
				<OrisoTextField
					id={id}
					label={label}
					value={inputText}
					placeholder={placeholder ?? displayFormat}
					helperText={helperText}
					error={error}
					disabled={disabled}
					fullWidth={fullWidth}
					onChange={(event) => setInputText(event.target.value)}
					onBlur={(event) => commitInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							commitInput(inputText);
						}
					}}
					InputProps={{
						endAdornment: (
							<InputAdornment position="end">
								<IconButton
									aria-label="Open time picker"
									edge="end"
									disabled={disabled}
									onClick={openDialog}
									sx={{
										color: orisoDateTimeColors.onSurfaceVariant
									}}
								>
									<ScheduleIcon />
								</IconButton>
							</InputAdornment>
						)
					}}
				/>
			)}
			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				sx={{ zIndex: 10001, ...orisoTimePickerDialogSx }}
			>
				<Typography
					sx={{
						color: orisoDateTimeColors.onSurfaceVariant,
						marginBottom: '20px',
						...orisoPickerTypography.labelMedium
					}}
				>
					{dialogTitle}
				</Typography>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '12px',
						marginBottom: mode === 'dial' ? '36px' : '24px'
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						{mode === 'dial' ? (
							<>
								<ButtonBase
									onClick={() => setSelecting('hour')}
									aria-label="Select hours"
									className={
										selecting === 'hour'
											? 'orisoTimeField--active'
											: ''
									}
									sx={timeFieldSx}
								>
									{ampm ? displayHour : pad(displayHour)}
								</ButtonBase>
								<Typography
									sx={{
										width: '24px',
										textAlign: 'center',
										color: orisoDateTimeColors.onSurface,
										...orisoPickerTypography.displayLarge
									}}
								>
									:
								</Typography>
								<ButtonBase
									onClick={() => setSelecting('minute')}
									aria-label="Select minutes"
									className={
										selecting === 'minute'
											? 'orisoTimeField--active'
											: ''
									}
									sx={timeFieldSx}
								>
									{pad(minute)}
								</ButtonBase>
							</>
						) : (
							<>
								<InputBase
									value={
										ampm
											? String(displayHour)
											: pad(displayHour)
									}
									onChange={(event) =>
										handleHourInput(event.target.value)
									}
									inputProps={{
										'aria-label': 'Hour',
										'inputMode': 'numeric'
									}}
									sx={timeInputSx}
								/>
								<Typography
									sx={{
										width: '24px',
										textAlign: 'center',
										color: orisoDateTimeColors.onSurface,
										...orisoPickerTypography.displayLarge
									}}
								>
									:
								</Typography>
								<InputBase
									value={pad(minute)}
									onChange={(event) =>
										handleMinuteInput(event.target.value)
									}
									inputProps={{
										'aria-label': 'Minute',
										'inputMode': 'numeric'
									}}
									sx={timeInputSx}
								/>
							</>
						)}
					</Box>
					{ampm && (
						<Box
							sx={{
								width: '52px',
								height: '80px',
								display: 'flex',
								flexDirection: 'column',
								borderRadius: '8px',
								overflow: 'hidden',
								border: `1px solid ${orisoDateTimeColors.outlineVariant}`
							}}
						>
							<ButtonBase
								onClick={() => setMeridiem('AM')}
								className={
									meridiem === 'AM'
										? 'orisoMeridiem--selected'
										: ''
								}
								sx={{
									...meridiemButtonSx,
									borderBottom: `1px solid ${orisoDateTimeColors.outlineVariant}`
								}}
							>
								AM
							</ButtonBase>
							<ButtonBase
								onClick={() => setMeridiem('PM')}
								className={
									meridiem === 'PM'
										? 'orisoMeridiem--selected'
										: ''
								}
								sx={meridiemButtonSx}
							>
								PM
							</ButtonBase>
						</Box>
					)}
				</Box>
				{mode === 'dial' && (
					<OrisoTimeDial
						selecting={selecting}
						hour24={hour24}
						minute={minute}
						ampm={ampm}
						onSelectHour={setHour24}
						onSelectMinute={setMinute}
						onHourSelected={() => setSelecting('minute')}
					/>
				)}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						marginTop: '20px'
					}}
				>
					<IconButton
						aria-label={
							mode === 'dial'
								? 'Switch to text input'
								: 'Switch to dial'
						}
						onClick={() =>
							setMode(mode === 'dial' ? 'input' : 'dial')
						}
						sx={{
							color: orisoDateTimeColors.onSurfaceVariant,
							marginLeft: '-8px'
						}}
					>
						{mode === 'dial' ? (
							<KeyboardOutlinedIcon />
						) : (
							<ScheduleIcon />
						)}
					</IconButton>
					<Box sx={{ flex: 1 }} />
					<Button onClick={() => setOpen(false)} sx={actionButtonSx}>
						{cancelLabel}
					</Button>
					<Button onClick={handleOk} sx={actionButtonSx}>
						{okLabel}
					</Button>
				</Box>
			</Dialog>
		</>
	);
};
