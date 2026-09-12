import * as React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { IconButton, InputAdornment, Popover } from '@mui/material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { OrisoTextField } from './OrisoTextField';
import { OrisoCalendar } from './OrisoCalendar';
import {
	orisoCalendarContainerSx,
	orisoDateTimeColors
} from './orisoDateTimeDesign';

dayjs.extend(customParseFormat);

export interface OrisoDatePickerProps {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
	/** Display and parse format, defaults to DD.MM.YYYY. */
	format?: string;
	helperText?: React.ReactNode;
	error?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	minDate?: Dayjs;
	maxDate?: Dayjs;
	/** First day of the week: 0 = Sunday, 1 = Monday. */
	weekStart?: 0 | 1;
	placeholder?: string;
	id?: string;
}

export const OrisoDatePicker = ({
	label,
	value,
	onChange,
	format = 'DD.MM.YYYY',
	helperText,
	error,
	disabled,
	fullWidth = true,
	minDate,
	maxDate,
	weekStart = 0,
	placeholder,
	id
}: OrisoDatePickerProps) => {
	const { t } = useTranslation();
	const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
	// Figma docked picker: day clicks are a draft, committed with OK.
	const [draft, setDraft] = React.useState<Dayjs | null>(null);
	const [inputText, setInputText] = React.useState(
		value ? value.format(format) : ''
	);

	React.useEffect(() => {
		setInputText(value ? value.format(format) : '');
	}, [value, format]);

	const commitInput = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) {
			onChange?.(null);
			return;
		}

		const parsed = dayjs(trimmed, format, true);
		if (parsed.isValid()) {
			onChange?.(parsed);
		} else {
			setInputText(value ? value.format(format) : '');
		}
	};

	const openPicker = (anchor: HTMLElement | null) => {
		setDraft(value);
		setAnchorEl(anchor);
	};

	const handleAccept = () => {
		if (draft) {
			onChange?.(draft);
		}
		setAnchorEl(null);
	};

	return (
		<>
			<OrisoTextField
				id={id}
				label={label}
				value={inputText}
				placeholder={placeholder ?? format}
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
								aria-label={t('form.datePicker.openCalendar')}
								edge="end"
								disabled={disabled}
								onClick={(event) =>
									openPicker(
										event.currentTarget.closest(
											'.MuiFormControl-root'
										) as HTMLElement
									)
								}
								sx={{
									color: orisoDateTimeColors.onSurfaceVariant
								}}
							>
								<CalendarTodayOutlinedIcon />
							</IconButton>
						</InputAdornment>
					)
				}}
			/>
			<Popover
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				onClose={() => setAnchorEl(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				sx={{ zIndex: 10001 }}
				PaperProps={{
					sx: {
						...orisoCalendarContainerSx,
						marginTop: '4px'
					}
				}}
			>
				<OrisoCalendar
					value={draft ?? value}
					onChange={setDraft}
					minDate={minDate}
					maxDate={maxDate}
					weekStart={weekStart}
					disableContainer
					autoFocus
					onCancel={() => setAnchorEl(null)}
					onAccept={handleAccept}
				/>
			</Popover>
		</>
	);
};
