import * as React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { Box, Button, ButtonBase, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
	orisoCalendarContainerSx,
	orisoDateTimeColors,
	orisoPickerTypography
} from './orisoDateTimeDesign';

export interface OrisoCalendarProps {
	/** Currently selected day. */
	value?: Dayjs | null;
	onChange?: (value: Dayjs) => void;
	minDate?: Dayjs;
	maxDate?: Dayjs;
	/** First day of the week: 0 = Sunday (Figma default), 1 = Monday. */
	weekStart?: 0 | 1;
	/** Month shown when no value is selected. */
	referenceDate?: Dayjs;
	/** Single-letter column headers, starting on Sunday. */
	dayLabels?: string[];
	/** Render without the elevated container (for embedding in popovers). */
	disableContainer?: boolean;
	autoFocus?: boolean;
	/** Figma docked picker footer: shown when either callback is provided. */
	onCancel?: () => void;
	onAccept?: () => void;
	cancelLabel?: string;
	okLabel?: string;
}

const DEFAULT_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DAY_CELL_SIZE = 40;

const isDayDisabled = (day: Dayjs, minDate?: Dayjs, maxDate?: Dayjs) =>
	Boolean(
		(minDate && day.isBefore(minDate, 'day')) ||
			(maxDate && day.isAfter(maxDate, 'day'))
	);

const dayCellSx = {
	'width': `${DAY_CELL_SIZE}px`,
	'height': `${DAY_CELL_SIZE}px`,
	'borderRadius': '50%',
	'color': orisoDateTimeColors.onSurface,
	'transition': 'background-color 120ms ease, color 120ms ease',
	...orisoPickerTypography.bodyLarge,
	'&:hover': {
		backgroundColor: orisoDateTimeColors.hoverLayer
	},
	'&.orisoCalendarDay--outside': {
		color: orisoDateTimeColors.disabledText
	},
	'&.orisoCalendarDay--today': {
		border: `1px solid ${orisoDateTimeColors.primary}`,
		color: orisoDateTimeColors.primary
	},
	'&.orisoCalendarDay--selected, &.orisoCalendarDay--selected:hover': {
		backgroundColor: orisoDateTimeColors.primary,
		color: orisoDateTimeColors.onPrimary
	},
	'&.Mui-disabled': {
		color: orisoDateTimeColors.disabledText
	},
	'&.Mui-focusVisible': {
		outline: `3px solid ${orisoDateTimeColors.focus}`,
		outlineOffset: '1px'
	}
} as const;

// Figma docked picker: month/year dropdowns open a scrollable list; the
// selected entry is a filled pill.
const menuItemSx = {
	'width': '100%',
	'height': '40px',
	'borderRadius': '20px',
	'justifyContent': 'center',
	'color': orisoDateTimeColors.onSurface,
	...orisoPickerTypography.bodyLarge,
	'&:hover': {
		backgroundColor: orisoDateTimeColors.hoverLayer
	},
	'&.orisoCalendarMenuItem--selected, &.orisoCalendarMenuItem--selected:hover':
		{
			backgroundColor: orisoDateTimeColors.primary,
			color: orisoDateTimeColors.onPrimary
		},
	'&.Mui-disabled': {
		color: orisoDateTimeColors.disabledText
	}
} as const;

const navIconSx = {
	'color': orisoDateTimeColors.onSurfaceVariant,
	'&:hover': {
		backgroundColor: orisoDateTimeColors.hoverLayer
	}
} as const;

const selectorButtonSx = {
	'height': '36px',
	'borderRadius': '18px',
	'padding': '0 4px 0 8px',
	'gap': '2px',
	'color': orisoDateTimeColors.onSurfaceVariant,
	...orisoPickerTypography.labelLarge,
	'&:hover': {
		backgroundColor: orisoDateTimeColors.hoverLayer
	}
} as const;

const actionButtonSx = {
	color: orisoDateTimeColors.primary,
	textTransform: 'none',
	borderRadius: '20px',
	padding: '10px 12px',
	...orisoPickerTypography.labelLarge
} as const;

type CalendarView = 'days' | 'months' | 'years';

export const OrisoCalendar = ({
	value,
	onChange,
	minDate,
	maxDate,
	weekStart = 0,
	referenceDate,
	dayLabels = DEFAULT_DAY_LABELS,
	disableContainer,
	autoFocus,
	onCancel,
	onAccept,
	cancelLabel,
	okLabel
}: OrisoCalendarProps) => {
	const { t } = useTranslation();
	const resolvedCancel = cancelLabel ?? t('form.calendar.cancel');
	const resolvedOk = okLabel ?? t('form.calendar.ok');
	const today = dayjs();
	const initialMonth = (value ?? referenceDate ?? today).startOf('month');
	const [viewMonth, setViewMonth] = React.useState<Dayjs>(initialMonth);
	const [view, setView] = React.useState<CalendarView>('days');
	const menuListRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (value) {
			setViewMonth(value.startOf('month'));
		}
	}, [value]);

	React.useEffect(() => {
		if (view !== 'days' && menuListRef.current) {
			const selected = menuListRef.current.querySelector<HTMLElement>(
				'.orisoCalendarMenuItem--selected'
			);
			selected?.scrollIntoView({ block: 'center' });
		}
	}, [view]);

	const minYear = (minDate ?? today.subtract(100, 'year')).year();
	const maxYear = (maxDate ?? today.add(100, 'year')).year();
	const years: number[] = [];
	for (let year = minYear; year <= maxYear; year++) {
		years.push(year);
	}

	const monthStart = viewMonth.startOf('month');
	const startOffset = (monthStart.day() - weekStart + 7) % 7;
	const gridStart = monthStart.subtract(startOffset, 'day');
	const weekCount = Math.ceil((startOffset + viewMonth.daysInMonth()) / 7);

	const weeks: Dayjs[][] = [];
	for (let week = 0; week < weekCount; week++) {
		const days: Dayjs[] = [];
		for (let day = 0; day < 7; day++) {
			days.push(gridStart.add(week * 7 + day, 'day'));
		}
		weeks.push(days);
	}

	const orderedDayLabels = Array.from(
		{ length: 7 },
		(_, index) => dayLabels[(index + weekStart) % 7]
	);

	const handleSelectDay = (day: Dayjs) => {
		const nextValue = value
			? day.hour(value.hour()).minute(value.minute())
			: day;
		if (!day.isSame(viewMonth, 'month')) {
			setViewMonth(day.startOf('month'));
		}
		onChange?.(nextValue);
	};

	const showFooter = Boolean(onCancel || onAccept);
	const gridHeight = DAY_CELL_SIZE * 7 + 24;

	const renderMenuList = (
		items: { key: number; label: string; selected: boolean }[],
		onSelect: (key: number) => void
	) => (
		<Box
			ref={menuListRef}
			sx={{
				height: `${gridHeight}px`,
				overflowY: 'auto',
				display: 'flex',
				flexDirection: 'column',
				gap: '4px',
				padding: '4px 8px'
			}}
		>
			{items.map((item) => (
				<ButtonBase
					key={item.key}
					onClick={() => onSelect(item.key)}
					className={
						item.selected ? 'orisoCalendarMenuItem--selected' : ''
					}
					sx={menuItemSx}
				>
					{item.label}
				</ButtonBase>
			))}
		</Box>
	);

	return (
		<Box
			sx={
				disableContainer ? { width: '304px' } : orisoCalendarContainerSx
			}
		>
			{/* Figma docked header: ‹ Month ▾ › on the left, ‹ Year ▾ › right */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					height: '48px'
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<IconButton
						size="small"
						aria-label={t('form.calendar.previousMonth')}
						disabled={view !== 'days'}
						onClick={() =>
							setViewMonth(viewMonth.subtract(1, 'month'))
						}
						sx={navIconSx}
					>
						<ChevronLeftIcon />
					</IconButton>
					<ButtonBase
						onClick={() =>
							setView(view === 'months' ? 'days' : 'months')
						}
						aria-label={t('form.calendar.selectMonth')}
						sx={selectorButtonSx}
					>
						{viewMonth.format('MMM')}
						<ArrowDropDownIcon
							sx={{
								fontSize: '20px',
								transform:
									view === 'months'
										? 'rotate(180deg)'
										: 'none',
								transition: 'transform 120ms ease'
							}}
						/>
					</ButtonBase>
					<IconButton
						size="small"
						aria-label={t('form.calendar.nextMonth')}
						disabled={view !== 'days'}
						onClick={() => setViewMonth(viewMonth.add(1, 'month'))}
						sx={navIconSx}
					>
						<ChevronRightIcon />
					</IconButton>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<IconButton
						size="small"
						aria-label={t('form.calendar.previousYear')}
						disabled={view !== 'days'}
						onClick={() =>
							setViewMonth(viewMonth.subtract(1, 'year'))
						}
						sx={navIconSx}
					>
						<ChevronLeftIcon />
					</IconButton>
					<ButtonBase
						onClick={() =>
							setView(view === 'years' ? 'days' : 'years')
						}
						aria-label={t('form.calendar.selectYear')}
						sx={selectorButtonSx}
					>
						{viewMonth.format('YYYY')}
						<ArrowDropDownIcon
							sx={{
								fontSize: '20px',
								transform:
									view === 'years'
										? 'rotate(180deg)'
										: 'none',
								transition: 'transform 120ms ease'
							}}
						/>
					</ButtonBase>
					<IconButton
						size="small"
						aria-label={t('form.calendar.nextYear')}
						disabled={view !== 'days'}
						onClick={() => setViewMonth(viewMonth.add(1, 'year'))}
						sx={navIconSx}
					>
						<ChevronRightIcon />
					</IconButton>
				</Box>
			</Box>
			{view === 'months' &&
				renderMenuList(
					Array.from({ length: 12 }, (_, month) => ({
						key: month,
						label: dayjs().month(month).format('MMMM'),
						selected: viewMonth.month() === month
					})),
					(month) => {
						setViewMonth(viewMonth.month(month));
						setView('days');
					}
				)}
			{view === 'years' &&
				renderMenuList(
					years.map((year) => ({
						key: year,
						label: String(year),
						selected: viewMonth.year() === year
					})),
					(year) => {
						setViewMonth(viewMonth.year(year));
						setView('days');
					}
				)}
			{view === 'days' && (
				<Box role="grid" aria-label={viewMonth.format('MMMM YYYY')}>
					<Box
						role="row"
						sx={{
							display: 'grid',
							gridTemplateColumns: 'repeat(7, 1fr)',
							justifyItems: 'center',
							height: `${DAY_CELL_SIZE}px`,
							alignItems: 'center'
						}}
					>
						{orderedDayLabels.map((label, index) => (
							<Typography
								key={`${label}-${index}`}
								component="span"
								role="columnheader"
								sx={{
									color: orisoDateTimeColors.onSurface,
									...orisoPickerTypography.bodyLarge
								}}
							>
								{label}
							</Typography>
						))}
					</Box>
					{weeks.map((week, weekIndex) => (
						<Box
							key={weekIndex}
							role="row"
							sx={{
								display: 'grid',
								gridTemplateColumns: 'repeat(7, 1fr)',
								justifyItems: 'center',
								marginBottom: '4px'
							}}
						>
							{week.map((day) => {
								const isCurrentMonth = day.isSame(
									viewMonth,
									'month'
								);
								const isSelected = Boolean(
									value && day.isSame(value, 'day')
								);
								const isToday = day.isSame(today, 'day');

								return (
									<ButtonBase
										key={day.format('YYYY-MM-DD')}
										focusRipple
										autoFocus={Boolean(
											autoFocus && isSelected
										)}
										disabled={isDayDisabled(
											day,
											minDate,
											maxDate
										)}
										onClick={() => handleSelectDay(day)}
										aria-label={day.format('D MMMM YYYY')}
										aria-pressed={isSelected}
										className={
											(isSelected
												? 'orisoCalendarDay--selected '
												: '') +
											(isToday && !isSelected
												? 'orisoCalendarDay--today '
												: '') +
											(!isCurrentMonth && !isSelected
												? 'orisoCalendarDay--outside'
												: '')
										}
										sx={dayCellSx}
									>
										{day.date()}
									</ButtonBase>
								);
							})}
						</Box>
					))}
				</Box>
			)}
			{showFooter && (
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '4px',
						paddingTop: '4px'
					}}
				>
					{onCancel && (
						<Button onClick={onCancel} sx={actionButtonSx}>
							{resolvedCancel}
						</Button>
					)}
					{onAccept && (
						<Button onClick={onAccept} sx={actionButtonSx}>
							{resolvedOk}
						</Button>
					)}
				</Box>
			)}
		</Box>
	);
};
