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

	/* A new value from outside shows in the format; the text that typed
	   this very day stays as it is (see typeInput). */
	const typedDay = React.useRef<Dayjs | null>(null);
	React.useEffect(() => {
		if (value && typedDay.current?.isSame(value, 'day')) return;
		typedDay.current = null;
		setInputText(value ? value.format(format) : '');
	}, [value, format]);

	/* The date a typed text means: the format, or the same without leading
	   zeros ("1.12.2026" for DD.MM.YYYY); null for anything else, or a day
	   outside the allowed range. */
	const parseInput = (text: string): Dayjs | null => {
		const parsed = [format, format.replace(/DD/, 'D').replace(/MM/, 'M')]
			.map((f) => dayjs(text.trim(), f, true))
			.find((d) => d.isValid());
		if (!parsed) return null;
		const outOfRange =
			(minDate && parsed.isBefore(minDate, 'day')) ||
			(maxDate && parsed.isAfter(maxDate, 'day'));
		return outOfRange ? null : parsed;
	};

	const commitInput = (text: string) => {
		if (!text.trim()) {
			onChange?.(null);
			return;
		}

		const parsed = parseInput(text);
		if (!parsed) {
			// A refused entry is not left standing: the field only ever shows the date the form holds.
			setInputText(value ? value.format(format) : '');
			return;
		}
		typedDay.current = null;
		setInputText(parsed.format(format));
		onChange?.(parsed);
	};

	/* A complete date counts as soon as it is typed, so a save right after
	   typing takes it, not only after leaving the field (Dev test, 24 Nov
	   2026). The text stays as typed until the field is left. */
	const typeInput = (text: string) => {
		setInputText(text);
		const parsed = parseInput(text);
		if (parsed && !(value && parsed.isSame(value, 'day'))) {
			typedDay.current = parsed;
			onChange?.(parsed);
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
				onChange={(event) => typeInput(event.target.value)}
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
