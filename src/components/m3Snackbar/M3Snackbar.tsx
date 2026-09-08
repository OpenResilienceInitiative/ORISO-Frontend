import * as React from 'react';
import { ReactNode } from 'react';
import { Alert, Box, Button, IconButton, Snackbar } from '@mui/material';
import type { SnackbarOrigin, SxProps, Theme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

/**
 * The M3 snackbar roles, as the design system publishes them
 * (Design-System-M3_ORISO, node 53977-34279).
 *
 * They are the *inverse* roles on purpose: a snackbar is the one surface in
 * this app that deliberately does not belong to the page it sits on, so it
 * takes the inverse of the page's surface, text and primary. The `--m3-*`
 * custom properties are the runtime tenant palette (`utils/theme/orisoScheme`);
 * the literals are the values Figma reports for the light scheme and only
 * apply when no palette has been injected — the same shape
 * `orisoInputColors` uses.
 */
export const m3SnackbarColors = {
	surface: 'var(--m3-inverse-surface, #303031)',
	onSurface: 'var(--m3-inverse-on-surface, #f3f0f1)',
	action: 'var(--m3-inverse-primary, #ffb4aa)'
} as const;

/** M3 `body/medium` — the message. */
const messageTypography = {
	fontSize: 14,
	fontWeight: 400,
	lineHeight: '20px',
	letterSpacing: '0.25px'
} as const;

/** M3 `label/large` — the action. */
const actionTypography = {
	fontSize: 14,
	fontWeight: 500,
	lineHeight: '20px',
	letterSpacing: '0.1px'
} as const;

/**
 * M3 Elevation 3, the level the design system puts this surface on. Written
 * out rather than taken from `theme.shadows[3]`, because MUI's shadow ramp is
 * the Material 2 one and reads noticeably softer beside the rest of the M3
 * chrome.
 */
const elevation3 =
	'0 1px 3px 0 rgba(0, 0, 0, 0.30), 0 4px 8px 3px rgba(0, 0, 0, 0.15)';

/** The widest the design system draws it. Below that it takes what it gets. */
export const M3_SNACKBAR_MAX_WIDTH = 344;

export interface M3SnackbarAction {
	/** Already translated. This component never calls `t`. */
	label: string;
	onClick?: (event: React.MouseEvent<HTMLElement>) => void;
	/** Overrides the generated `data-testid`. */
	testId?: string;
}

export interface M3SnackbarProps {
	/**
	 * The message. One line or two — the design system draws both from the same
	 * component and lets the content decide, so there is no `lines` prop to get
	 * wrong. A `ReactNode` because the live-chat privacy note carries a link
	 * inside the sentence.
	 */
	message: ReactNode;
	/**
	 * The optional single action, right of the message. Snackbars carry at most
	 * one — a second would make this a dialog.
	 */
	action?: M3SnackbarAction;
	/**
	 * Put the action on its own line, right-aligned, instead of beside the
	 * message. The design system calls this shape "longer action": a label that
	 * would squeeze the message into a column gets a row of its own.
	 */
	actionOnOwnLine?: boolean;
	/**
	 * The close affordance — the ✕ at the right edge. Passing a handler is what
	 * makes it appear; omit it and the snackbar has no ✕, which is the other
	 * half of every row in the design system sheet.
	 */
	onClose?: () => void;
	/** Accessible name of the ✕. Already translated. Required with `onClose`. */
	closeLabel?: string;
	/**
	 * `'floating'` (default) is the real snackbar: MUI's `Snackbar`, fixed over
	 * the page, bottom-centre unless `anchorOrigin` says otherwise.
	 *
	 * `'inline'` renders the same surface in the document flow, for the places
	 * where the note belongs at one exact spot in a form rather than over it —
	 * the live-chat account step puts it where the consent checkbox used to
	 * sit (ORISO-Frontend#1341, item 5). One surface definition, two placements,
	 * so the two can never drift apart.
	 */
	placement?: 'floating' | 'inline';
	/** Floating only. Defaults to open — an unmounted snackbar is the closed one. */
	open?: boolean;
	/** Floating only. `null` (default) keeps it until it is dismissed. */
	autoHideDuration?: number | null;
	/** Floating only. Defaults to bottom-centre, the M3 resting place. */
	anchorOrigin?: SnackbarOrigin;
	/**
	 * `'alert'` (default) interrupts a screen reader — right for something that
	 * just happened. A note that is simply *present* when the screen opens is
	 * `'status'`, which waits its turn.
	 */
	role?: 'alert' | 'status';
	/** Layout only. Paint belongs to the roles above. */
	sx?: SxProps<Theme>;
	testId?: string;
}

/**
 * The ORISO snackbar.
 *
 * **Why it exists.** There was none — every transient notice in this app was
 * either a dialog (too much) or nothing at all. The design system has had one
 * since M3 (node 53977-34279) and draws exactly ten shapes of it: one or two
 * lines, no action / an action beside the message / a longer action on its own
 * row, each with and without a close ✕. All ten are this component with
 * different props, and `M3Snackbar.stories.tsx` shows the ten side by side.
 *
 * **What it does not do: paint its own colours.** The dark surface is the M3
 * *inverse* role trio read from the runtime tenant palette, so a tenant that
 * seeds a different brand gets a snackbar in it without touching this file.
 *
 * **Structure comes from MUI** — `Snackbar` for the fixed placement and the
 * grow/fade transition, `Alert` for the message/action/close anatomy and its
 * live-region semantics. The icon is switched off (`icon={false}`): M3
 * snackbars carry no severity glyph, and this one is not an error surface.
 */
export const M3Snackbar = ({
	message,
	action,
	actionOnOwnLine = false,
	onClose,
	closeLabel,
	placement = 'floating',
	open = true,
	autoHideDuration = null,
	anchorOrigin = { vertical: 'bottom', horizontal: 'center' },
	role = 'alert',
	sx,
	testId = 'm3-snackbar'
}: M3SnackbarProps) => {
	const actionButton = action && (
		<Button
			variant="text"
			onClick={action.onClick}
			data-testid={action.testId ?? `${testId}-action`}
			sx={{
				...actionTypography,
				'color': m3SnackbarColors.action,
				'textTransform': 'none',
				'minWidth': 0,
				'px': 1,
				'py': 0.5,
				/* The label is one word, not a paragraph. Without this the flex
				   row squeezes it into a column of single letters as soon as
				   the message beside it needs the room — and a longer language
				   needs it sooner than German does. A label that will not fit
				   belongs on its own line (`actionOnOwnLine`), not broken
				   apart. */
				'whiteSpace': 'nowrap',
				'flexShrink': 0,
				'&:hover': {
					backgroundColor: 'rgba(255, 255, 255, 0.08)'
				},
				'&:focus-visible': {
					outline: `2px solid ${m3SnackbarColors.action}`,
					outlineOffset: 2
				}
			}}
		>
			{action.label}
		</Button>
	);

	const closeButton = onClose && (
		<IconButton
			aria-label={closeLabel}
			onClick={onClose}
			data-testid={`${testId}-close`}
			sx={{
				'color': m3SnackbarColors.onSurface,
				'p': 1,
				/* The theme paints every icon button white on hover, which is
				   invisible here — this surface is already dark. Give it the
				   state layer M3 asks for instead, and keep the glyph. */
				'&:hover': {
					color: m3SnackbarColors.onSurface,
					backgroundColor: 'rgba(255, 255, 255, 0.08)'
				},
				'&:focus-visible': {
					outline: `2px solid ${m3SnackbarColors.onSurface}`,
					outlineOffset: -2
				}
			}}
		>
			<CloseRoundedIcon sx={{ fontSize: 20 }} />
		</IconButton>
	);

	/* An action on its own line is not an `Alert` action any more — MUI puts
	   that slot beside the message and it would never wrap. It goes under the
	   message instead, right-aligned, and only the ✕ stays in the action slot,
	   which is exactly the anatomy the design system draws. */
	const alertAction =
		actionOnOwnLine && action ? (
			closeButton || undefined
		) : action || onClose ? (
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
				{actionButton}
				{closeButton}
			</Box>
		) : undefined;

	const surface = (
		<Alert
			icon={false}
			role={role}
			action={alertAction}
			data-testid={testId}
			sx={{
				'width': '100%',
				'maxWidth': M3_SNACKBAR_MAX_WIDTH,
				'boxSizing': 'border-box',
				'backgroundColor': m3SnackbarColors.surface,
				'color': m3SnackbarColors.onSurface,
				'borderRadius': '4px',
				'boxShadow': elevation3,
				'alignItems': 'center',
				'px': 2,
				'py': 1,
				/* MUI reserves a right gutter for the action slot; with the ✕
				   already carrying its own padding that reads as a hole. */
				'& .MuiAlert-action': {
					alignItems: 'center',
					flexShrink: 0,
					mr: 0,
					pt: 0,
					pl: 1
				},
				'& .MuiAlert-message': {
					...messageTypography,
					py: '6px',
					minWidth: 0,
					overflowWrap: 'anywhere'
				},
				...sx
			}}
		>
			{message}
			{actionOnOwnLine && action && (
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'flex-end',
						mt: 0.5,
						mr: -1
					}}
				>
					{actionButton}
				</Box>
			)}
		</Alert>
	);

	if (placement === 'inline') {
		return open ? surface : null;
	}

	return (
		<Snackbar
			open={open}
			autoHideDuration={autoHideDuration}
			anchorOrigin={anchorOrigin}
			/* A click anywhere else on the page is not a dismissal. MUI's
			   default would treat it as one, so a note somebody has not read
			   yet would vanish the moment they touched the form behind it. */
			onClose={(_event, reason) => {
				if (reason === 'clickaway') {
					return;
				}
				onClose?.();
			}}
			sx={{ maxWidth: M3_SNACKBAR_MAX_WIDTH, width: '100%' }}
		>
			{surface}
		</Snackbar>
	);
};
