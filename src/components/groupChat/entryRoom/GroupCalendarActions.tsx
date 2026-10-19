import * as React from 'react';
import { Box, Button } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from 'react-i18next';

export interface GroupCalendarActionsProps {
	/** Opens the calendar choice for this date; unset once it has begun. */
	onAddThis?: (event: React.MouseEvent<HTMLElement>) => void;
	/** Opens "Nächste Termine"; unset while there is no other date. */
	onMoreDates?: () => void;
	/** The first guess before the row has been measured. */
	phone: boolean;
}

/** Below this the split button's long label would be cut off. */
const SPLIT_MIN_WIDTH = 560;

/* The row's own width, not the window's: in the chat card a desktop window
   can leave a 370 px column (#1499). */
const useRowWidth = () => {
	const [row, setRow] = React.useState<HTMLElement | null>(null);
	const [width, setWidth] = React.useState<number | null>(null);
	React.useLayoutEffect(() => {
		if (!row) return;
		const measure = () =>
			setWidth(row.getBoundingClientRect().width || null);
		measure();
		const RO = globalThis.ResizeObserver;
		if (!RO) return;
		const observer = new RO(measure);
		observer.observe(row);
		return () => observer.disconnect();
	}, [row]);
	return [setRow, width] as const;
};

/**
 * The calendar row above "Beitreten" (Frank, 2026-10-19). Where there is room
 * one split button: this date on the left, the other dates on the right. On
 * a phone or in a narrow chat column two quiet buttons side by side.
 */
export const GroupCalendarActions = ({
	onAddThis,
	onMoreDates,
	phone
}: GroupCalendarActionsProps) => {
	const { t } = useTranslation();
	const addLabel = t(
		'groupChat.calendar.addThis',
		'Diesen Termin zum Kalender hinzufügen'
	);
	const moreLabel = t('groupChat.entry.moreDates', 'Weitere Termine');
	const both = Boolean(onAddThis && onMoreDates);
	const [rowRef, width] = useRowWidth();
	const compact = width === null ? phone : width < SPLIT_MIN_WIDTH;

	if (compact) {
		return (
			<Box
				ref={rowRef}
				sx={{
					display: 'grid',
					gridTemplateColumns: both ? '1fr 1fr' : '1fr',
					gap: 1
				}}
			>
				{onAddThis && (
					<Button
						variant="text"
						size="small"
						onClick={onAddThis}
						title={addLabel}
						data-testid="group-entry-calendar"
						sx={phoneSx}
					>
						{t(
							'groupChat.calendar.addThisShort',
							'In den Kalender'
						)}
					</Button>
				)}
				{onMoreDates && (
					<Button
						variant="text"
						size="small"
						onClick={onMoreDates}
						data-testid="group-entry-dates"
						sx={phoneSx}
					>
						{moreLabel}
					</Button>
				)}
			</Box>
		);
	}

	/* M3 split button: two segments, a 2 px gap, the inner corners small. */
	return (
		<Box ref={rowRef} sx={{ display: 'flex', gap: '2px', width: '100%' }}>
			{onAddThis && (
				<Button
					variant="outlined"
					startIcon={<CalendarMonthRoundedIcon />}
					onClick={onAddThis}
					title={addLabel}
					data-testid="group-entry-calendar"
					sx={{
						...segmentSx,
						flex: '1 1 0',
						...(both ? innerEnd : {})
					}}
				>
					{addLabel}
				</Button>
			)}
			{onMoreDates && (
				<Button
					variant="outlined"
					endIcon={<ArrowForwardRoundedIcon />}
					onClick={onMoreDates}
					data-testid="group-entry-dates"
					sx={{
						...segmentSx,
						flex: both ? '0 0 auto' : '1 1 0',
						...(both ? innerStart : {})
					}}
				>
					{moreLabel}
				</Button>
			)}
		</Box>
	);
};

/** Layout only; colour and hover come from the theme's outlined button. */
const segmentSx = {
	minWidth: 0,
	minHeight: 56,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap'
} as const;

const innerEnd = {
	borderTopRightRadius: 4,
	borderBottomRightRadius: 4
} as const;

const innerStart = {
	borderTopLeftRadius: 4,
	borderBottomLeftRadius: 4
} as const;

/* Quiet: sentence case, not the theme's capitals (Frank: "dezent"). */
const phoneSx = {
	minHeight: 36,
	px: 1,
	fontSize: 14,
	fontWeight: 600,
	textTransform: 'none',
	whiteSpace: 'nowrap',
	overflow: 'hidden',
	textOverflow: 'ellipsis'
} as const;
