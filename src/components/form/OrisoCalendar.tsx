import * as React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
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
	/** First day of the week: 0 = Sunday, 1 = Monday. */
	weekStart?: 0 | 1;
	/** Month shown when no value is selected. */
	referenceDate?: Dayjs;
	/** Single-letter column headers, starting on Sunday. */
	dayLabels?: string[];
	/** Render without the elevated container (for embedding in popovers). */
	disableContainer?: boolean;
	autoFocus?: boolean;
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

const yearCellSx = {
	'height': '36px',
	'borderRadius': '18px',
	'color': orisoDateTimeColors.onSurface,
	...orisoPickerTypography.bodyLarge,
	'&:hover': {
		backgroundColor: orisoDateTimeColors.hoverLayer
	},
	'&.orisoCalendarYear--selected, &.orisoCalendarYear--selected:hover': {
		backgroundColor: orisoDateTimeColors.primary,
		color: orisoDateTimeColors.onPrimary
	},
	'&.orisoCalendarYear--current': {
		border: `1px solid ${orisoDateTimeColors.primary}`,
		color: orisoDateTimeColors.primary
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

export const OrisoCalendar = ({
	value,
	onChange,
	minDate,
	maxDate,
	weekStart = 1,
	referenceDate,
	dayLabels = DEFAULT_DAY_LABELS,
	disableContainer,
	autoFocus
}: OrisoCalendarProps) => {
	const today = dayjs();
	const initialMonth = (value ?? referenceDate ?? today).startOf('month');
	const [viewMonth, setViewMonth] = React.useState<Dayjs>(initialMonth);
	const [yearView, setYearView] = React.useState(false);
	const yearListRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (value) {
			setViewMonth(value.startOf('month'));
		}
	}, [value]);

	React.useEffect(() => {
		if (yearView && yearListRef.current) {
			const selected = yearListRef.current.querySelector<HTMLElement>(
				'.orisoCalendarYear--selected, .orisoCalendarYear--current'
			);
			selected?.scrollIntoView({ block: 'center' });
		}
	}, [yearView]);

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
		onChange?.(nextValue);
	};

	const handleSelectYear = (year: number) => {
		setViewMonth(viewMonth.year(year));
		setYearView(false);
	};

	const isPrevDisabled =
		minDate &&
		viewMonth.subtract(1, 'month').endOf('month').isBefore(minDate, 'day');
	const isNextDisabled =
		maxDate && viewMonth.add(1, 'month').isAfter(maxDate, 'day');

	return (
		<Box
			sx={
				disableContainer ? { width: '304px' } : orisoCalendarContainerSx
			}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					height: '48px',
					paddingLeft: '4px'
				}}
			>
				<ButtonBase
					onClick={() => setYearView(!yearView)}
					aria-label={
						yearView ? 'Switch to day view' : 'Switch to year view'
					}
					sx={{
						'height': '36px',
						'borderRadius': '18px',
						'padding': '0 4px 0 12px',
						'gap': '4px',
						'color': orisoDateTimeColors.onSurfaceVariant,
						...orisoPickerTypography.labelLarge,
						'&:hover': {
							backgroundColor: orisoDateTimeColors.hoverLayer
						}
					}}
				>
					{viewMonth.format('MMMM YYYY')}
					<ArrowDropDownIcon
						sx={{
							fontSize: '20px',
							transform: yearView ? 'rotate(180deg)' : 'none',
							transition: 'transform 120ms ease'
						}}
					/>
				</ButtonBase>
				{!yearView && (
					<Box sx={{ display: 'flex' }}>
						<IconButton
							size="small"
							aria-label="Previous month"
							disabled={Boolean(isPrevDisabled)}
							onClick={() =>
								setViewMonth(viewMonth.subtract(1, 'month'))
							}
							sx={navIconSx}
						>
							<ChevronLeftIcon />
						</IconButton>
						<IconButton
							size="small"
							aria-label="Next month"
							disabled={Boolean(isNextDisabled)}
							onClick={() =>
								setViewMonth(viewMonth.add(1, 'month'))
							}
							sx={navIconSx}
						>
							<ChevronRightIcon />
						</IconButton>
					</Box>
				)}
			</Box>
			{yearView ? (
				<Box
					ref={yearListRef}
					sx={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, 1fr)',
						gap: '8px',
						maxHeight: `${DAY_CELL_SIZE * 7}px`,
						overflowY: 'auto',
						padding: '4px'
					}}
				>
					{years.map((year) => (
						<ButtonBase
							key={year}
							onClick={() => handleSelectYear(year)}
							className={
								(value?.year() === year
									? 'orisoCalendarYear--selected '
									: '') +
								(today.year() === year && value?.year() !== year
									? 'orisoCalendarYear--current'
									: '')
							}
							sx={yearCellSx}
						>
							{year}
						</ButtonBase>
					))}
				</Box>
			) : (
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
								justifyItems: 'center'
							}}
						>
							{week.map((day) => {
								const isCurrentMonth = day.isSame(
									viewMonth,
									'month'
								);
								if (!isCurrentMonth) {
									return (
										<Box
											key={day.format('YYYY-MM-DD')}
											sx={{
												width: `${DAY_CELL_SIZE}px`,
												height: `${DAY_CELL_SIZE}px`
											}}
										/>
									);
								}

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
												? 'orisoCalendarDay--today'
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
		</Box>
	);
};
