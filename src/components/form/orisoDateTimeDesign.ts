import { orisoInputColors } from './orisoInputDesign';

/**
 * M3 ORISO tokens for the calendar, date picker and time picker.
 * Extends the shared input palette with the tonal container colors
 * used by the M3 date/time picker specs.
 */
export const orisoDateTimeColors = {
	...orisoInputColors,
	// Light keeps the pale-pink field with dark ink (the literal fallback);
	// the dark scheme sets the `--oriso-picker-*` pair in
	// `mui-variables-mapping.scss` (P0 dark mode, 2026-11-25).
	primaryContainer: 'var(--oriso-picker-active-surface, #ffdad7)',
	onPrimaryContainer: 'var(--oriso-picker-active-ink, #410004)',
	// Ink on the selected calendar day (`primary` fill).
	onPrimarySelected:
		'var(--oriso-picker-selected-ink, var(--m3-on-primary-container, #ffe2de))',
	surfaceContainerHighest: 'var(--m3-surface-container-highest, #e5e2e2)',
	scrim: 'rgba(27, 27, 28, 0.32)',
	// M3 disabled text: on-surface at 38 %, so it follows the scheme.
	disabledText:
		'color-mix(in srgb, var(--m3-on-surface, #1b1b1c) 38%, transparent)'
} as const;

export const orisoPickerTypography = {
	labelLarge: {
		fontSize: '14px',
		lineHeight: '20px',
		letterSpacing: '0.1px',
		fontWeight: 500
	},
	labelMedium: {
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.5px',
		fontWeight: 500
	},
	bodyLarge: {
		fontSize: '16px',
		lineHeight: '24px',
		letterSpacing: '0.5px',
		fontWeight: 400
	},
	bodySmall: {
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.4px',
		fontWeight: 400
	},
	displayLarge: {
		fontSize: '45px',
		lineHeight: '52px',
		letterSpacing: '0px',
		fontWeight: 400
	}
} as const;

/** Elevation used by the docked calendar and the time picker dialog. */
export const orisoPickerElevation =
	'0 12px 24px rgba(27, 27, 28, 0.14), 0 4px 8px rgba(27, 27, 28, 0.10)';

/** M3 docked date picker container (Figma: Date picker – docked). */
export const orisoCalendarContainerSx = {
	width: '328px',
	borderRadius: '16px',
	backgroundColor: orisoDateTimeColors.surfaceContainerHigh,
	boxShadow: orisoPickerElevation,
	padding: '8px 12px 12px',
	boxSizing: 'border-box'
} as const;

/** M3 time picker dialog container (Figma: Time picker). */
export const orisoTimePickerDialogSx = {
	'& .MuiDialog-paper': {
		borderRadius: '28px',
		backgroundColor: orisoDateTimeColors.surfaceContainerHigh,
		boxShadow: orisoPickerElevation,
		padding: '24px',
		minWidth: '328px',
		maxWidth: '360px'
	}
} as const;
