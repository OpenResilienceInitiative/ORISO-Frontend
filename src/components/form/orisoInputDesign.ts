export const orisoInputColors = {
	onSurface: '#1b1b1c',
	onSurfaceVariant: '#444748',
	outline: '#74777b',
	outlineVariant: '#c4c7c8',
	surface: '#ffffff',
	surfaceContainerLowest: '#ffffff',
	surfaceContainerLow: '#f7f4f4',
	surfaceContainer: '#f1eeee',
	surfaceContainerHigh: '#ebe8e8',
	secondary: '#4c555f',
	onSecondary: '#ffffff',
	primary: '#a4262e',
	onPrimary: '#ffffff',
	primaryDark: '#7e1d23',
	error: '#b1005e',
	focus: '#2d6f7b',
	focusLayer: 'rgba(45, 111, 123, 0.12)',
	selectedLayer: 'rgba(164, 38, 46, 0.08)',
	hoverLayer: 'rgba(27, 27, 28, 0.04)'
} as const;

const orisoInputAutofill = '#e8f0fe';

export const orisoTextFieldSx = {
	'& .MuiOutlinedInput-root': {
		'borderRadius': '12px',
		'backgroundColor': orisoInputColors.surfaceContainerLowest,
		'color': orisoInputColors.onSurface,
		'fontSize': 17,
		'transition':
			'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
		'& fieldset': {
			borderColor: orisoInputColors.outlineVariant
		},
		'&:hover fieldset': {
			borderColor: orisoInputColors.outline
		},
		'&.Mui-focused': {
			boxShadow: `0 0 0 4px ${orisoInputColors.focusLayer}`
		},
		'&.Mui-focused fieldset': {
			borderColor: orisoInputColors.focus,
			borderWidth: 2
		},
		'&.Mui-error fieldset': {
			borderColor: orisoInputColors.error,
			borderWidth: 2
		},
		'&:has(input:-webkit-autofill)': {
			backgroundColor: orisoInputAutofill
		}
	},
	'& .MuiInputBase-input': {
		'paddingTop': '16px',
		'paddingBottom': '16px',
		'&:-webkit-autofill': {
			WebkitBoxShadow: `0 0 0 100px ${orisoInputAutofill} inset`,
			WebkitTextFillColor: orisoInputColors.onSurface,
			caretColor: orisoInputColors.onSurface,
			transition: 'background-color 9999s ease-out 0s'
		},
		'&::placeholder': {
			color: orisoInputColors.onSurfaceVariant,
			opacity: 1
		}
	},
	'& .MuiInputAdornment-root': {
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiFormHelperText-root': {
		marginLeft: 0,
		marginTop: '8px',
		fontSize: '14px',
		lineHeight: '20px',
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiFormHelperText-root.Mui-error': {
		color: `${orisoInputColors.error} !important`
	}
} as const;
