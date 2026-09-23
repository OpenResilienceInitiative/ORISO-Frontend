import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, useMediaQuery } from '@mui/material';
import { keyframes } from '@mui/system';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'react-i18next';
import {
	M3_SNACKBAR_ABOVE_NAVIGATION_BOTTOM,
	M3_SNACKBAR_ELEVATION,
	M3_SNACKBAR_PHONE_MEDIA,
	m3SnackbarColors,
	useFloatingSnackbarPresence
} from './M3Snackbar';
import {
	appSnackbarStack,
	SnackbarStack,
	SnackbarStackEntry,
	useSnackbarStackEntries
} from './snackbarStack';

/** Desktop column: fits the 400 px list column with a 16 px gutter each side. */
export const M3_SNACKBAR_STACK_WIDTH = 368;
/**
 * The column keeps 8 px of padding so the cards' elevation shadow is not cut
 * off by its scroll box; the offsets below subtract it again. Clear of the
 * navigation rail (85 px) plus the 16 px gutter.
 */
const SHADOW_ROOM = 8;
const DESKTOP_START = `calc(85px + 16px - ${SHADOW_ROOM}px)`;

const enter = keyframes`
	from { opacity: 0; transform: translateY(16px); }
	to { opacity: 1; transform: none; }
`;

const visuallyHidden = {
	position: 'absolute',
	width: 1,
	height: 1,
	overflow: 'hidden',
	clip: 'rect(0 0 0 0)',
	whiteSpace: 'nowrap'
} as const;

export interface M3SnackbarHostProps {
	/** Defaults to the app-wide stack. Stories and tests pass their own. */
	stack?: SnackbarStack;
	/**
	 * How many sit on screen before the older ones fold into "+N more".
	 * Defaults to 3 on desktop and 2 on a phone, where every card covers chat.
	 */
	maxVisible?: number;
}

/**
 * The app's one place for snackbars that arrive on their own — several at a
 * time when several people knock at once (#1499).
 *
 * **Order.** M3 shows a single snackbar at the bottom edge. The stack keeps
 * that spot for the newest one and lets older ones rise above it, so the
 * thing that just happened is always where a snackbar is expected, and the
 * reading order (oldest → newest) matches first-come, first-served — the
 * person who knocked first is read and handled first. Beyond `maxVisible`
 * the OLDEST fold into a "+N more" chip at the top: the newest never hides.
 *
 * **Place.** Desktop: bottom-start, over the list column, so it never covers
 * the composer a moderator is typing into. Phone: full width above the
 * bottom navigation bar, the spot `M3Snackbar` already uses.
 *
 * **Accessibility.** A named landmark (screen-reader users can jump to it);
 * arrivals are announced once through a polite live region and never steal
 * focus; timed entries pause while the pointer or focus is on the stack
 * (WCAG 2.2.1); Escape closes a dismissible entry but never one that waits
 * for a decision; with reduced motion they appear without sliding.
 */
export const M3SnackbarHost = ({
	stack = appSnackbarStack,
	maxVisible
}: M3SnackbarHostProps) => {
	const { t } = useTranslation();
	const entries = useSnackbarStackEntries(stack);
	const phone = useMediaQuery('(max-width: 899.98px)');
	const limit = maxVisible ?? (phone ? 2 : 3);
	const [expanded, setExpanded] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focusedWithin, setFocusedWithin] = useState(false);
	const paused = hovered || focusedWithin;

	useFloatingSnackbarPresence(entries.length > 0);
	useAutoHide(entries, paused, stack.dismiss);
	const announcement = useArrivalAnnouncement(entries);

	const hiddenCount = Math.max(0, entries.length - limit);
	useEffect(() => {
		if (hiddenCount === 0) setExpanded(false);
	}, [hiddenCount]);
	const shown =
		expanded || hiddenCount === 0 ? entries : entries.slice(hiddenCount);

	return (
		<>
			<Box role="status" aria-live="polite" sx={visuallyHidden}>
				{announcement}
			</Box>
			{entries.length > 0 && (
				<Box
					role="region"
					aria-label={t('snackbar.stack.region')}
					data-testid="m3-snackbar-host"
					onMouseEnter={() => setHovered(true)}
					onMouseLeave={() => setHovered(false)}
					onFocus={() => setFocusedWithin(true)}
					onBlur={(event: React.FocusEvent<HTMLElement>) => {
						if (
							!event.currentTarget.contains(
								event.relatedTarget as Node | null
							)
						) {
							setFocusedWithin(false);
						}
					}}
					sx={{
						position: 'fixed',
						/* Under MUI's modal layer (1300), unlike MUI's own snackbar
						   (1400): the join-request popup opens from this stack and
						   must cover it, backdrop included. */
						zIndex: 1250,
						bottom: 24 - SHADOW_ROOM,
						left: DESKTOP_START,
						width: M3_SNACKBAR_STACK_WIDTH + 2 * SHADOW_ROOM,
						p: `${SHADOW_ROOM}px`,
						boxSizing: 'border-box',
						maxHeight: 'calc(100vh - 32px)',
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'stretch',
						gap: 1,
						[M3_SNACKBAR_PHONE_MEDIA]: {
							bottom: `calc(${M3_SNACKBAR_ABOVE_NAVIGATION_BOTTOM} - ${SHADOW_ROOM}px)`,
							left: '50%',
							transform: 'translateX(-50%)',
							width: '100%',
							maxHeight: `calc(100vh - ${M3_SNACKBAR_ABOVE_NAVIGATION_BOTTOM} - 16px)`
						}
					}}
				>
					{hiddenCount > 0 && (
						<ButtonBase
							aria-expanded={expanded}
							onClick={() => setExpanded((open) => !open)}
							data-testid="m3-snackbar-host-more"
							sx={{
								'alignSelf': 'flex-start',
								'gap': 0.5,
								'px': 1.5,
								'height': 32,
								'borderRadius': '8px',
								'fontSize': 14,
								'fontWeight': 500,
								'lineHeight': '20px',
								'letterSpacing': '0.1px',
								'backgroundColor': m3SnackbarColors.surface,
								'color': m3SnackbarColors.onSurface,
								'boxShadow': M3_SNACKBAR_ELEVATION,
								'&:focus-visible': {
									outline: `2px solid ${m3SnackbarColors.action}`,
									outlineOffset: 2
								}
							}}
						>
							{expanded ? (
								<ExpandMoreRoundedIcon
									aria-hidden
									sx={{ fontSize: 18 }}
								/>
							) : (
								<ExpandLessRoundedIcon
									aria-hidden
									sx={{ fontSize: 18 }}
								/>
							)}
							{expanded
								? t('snackbar.stack.less')
								: t('snackbar.stack.more', {
										count: hiddenCount
									})}
						</ButtonBase>
					)}
					{shown.map((entry) => (
						<HostItem
							key={entry.id}
							entry={entry}
							dismiss={() => stack.dismiss(entry.id)}
						/>
					))}
				</Box>
			)}
		</>
	);
};

const HostItem = ({
	entry,
	dismiss
}: {
	entry: SnackbarStackEntry;
	dismiss: () => void;
}) => (
	<Box
		data-testid="m3-snackbar-host-item"
		data-snackbar-id={entry.id}
		onKeyDown={(event: React.KeyboardEvent) => {
			if (event.key === 'Escape' && entry.dismissible) {
				event.stopPropagation();
				dismiss();
			}
		}}
		sx={{
			'animation': `${enter} 200ms cubic-bezier(0.05, 0.7, 0.1, 1)`,
			'@media (prefers-reduced-motion: reduce)': { animation: 'none' },
			/* The surfaces inside carry their own max width for the free
			   placement; in the stack the column decides. */
			'& > *': { maxWidth: 'none' }
		}}
	>
		{entry.render({ dismiss })}
	</Box>
);

/** Lets timed entries go, with the clock stopped while `paused`. */
const useAutoHide = (
	entries: readonly SnackbarStackEntry[],
	paused: boolean,
	dismiss: (id: string) => void
) => {
	const remaining = useRef(new Map<string, number>());
	useEffect(() => {
		const left = remaining.current;
		const timed = entries.filter((entry) => entry.autoHideDuration);
		const ids = new Set(timed.map((entry) => entry.id));
		left.forEach((_, id) => {
			if (!ids.has(id)) left.delete(id);
		});
		timed.forEach((entry) => {
			if (!left.has(entry.id)) {
				left.set(entry.id, entry.autoHideDuration!);
			}
		});
		if (paused) return;
		const startedAt = Date.now();
		const timers = timed.map((entry) =>
			setTimeout(() => dismiss(entry.id), left.get(entry.id))
		);
		return () => {
			const elapsed = Date.now() - startedAt;
			timers.forEach(clearTimeout);
			timed.forEach((entry) => {
				const ms = left.get(entry.id);
				if (ms !== undefined) {
					left.set(entry.id, Math.max(0, ms - elapsed));
				}
			});
		};
	}, [entries, paused, dismiss]);
};

/** The newest arrival's text, set once when it arrives. */
const useArrivalAnnouncement = (entries: readonly SnackbarStackEntry[]) => {
	const known = useRef(new Set<string>());
	const [text, setText] = useState('');
	const announce = useCallback((next: string) => setText(next), []);
	useEffect(() => {
		const arrivals = entries.filter(
			(entry) => !known.current.has(entry.id)
		);
		known.current = new Set(entries.map((entry) => entry.id));
		if (arrivals.length) {
			announce(arrivals[arrivals.length - 1].announcement);
		}
	}, [entries, announce]);
	return text;
};
