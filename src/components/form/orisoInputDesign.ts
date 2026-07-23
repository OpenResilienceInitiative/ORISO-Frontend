export const orisoInputColors = {
	onSurface: '#1b1b1c',
	onSurfaceVariant: '#444748',
	outline: '#747878',
	outlineVariant: '#747878',
	surface: '#fcf9f9',
	surfaceContainerLowest: '#fcf9f9',
	surfaceContainerLow: '#f7f4f4',
	surfaceContainer: '#f1eeee',
	surfaceContainerHigh: '#ebe8e8',
	secondary: '#4c555f',
	onSecondary: '#ffffff',
	primary: '#a5000a',
	onPrimary: '#ffffff',
	primaryDark: '#7e0008',
	error: '#b1005e',
	focus: '#a5000a',
	focusLayer: 'rgba(165, 0, 10, 0.08)',
	selectedLayer: 'rgba(165, 0, 10, 0.08)',
	hoverLayer: 'rgba(27, 27, 28, 0.04)'
} as const;

const orisoInputAutofill = '#e8f0fe';

export const orisoTextFieldSx = {
	'&': {
		marginTop: '20px'
	},
	'& .MuiInputLabel-root': {
		color: orisoInputColors.onSurfaceVariant,
		fontSize: '16px',
		lineHeight: '24px',
		letterSpacing: '0.5px'
	},
	'& .MuiInputLabel-root.MuiInputLabel-shrink': {
		backgroundColor: orisoInputColors.surface,
		color: orisoInputColors.onSurfaceVariant,
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.4px',
		padding: '0 4px',
		transform: 'translate(12px, -7px) scale(1)'
	},
	'& .MuiInputLabel-root.Mui-focused': {
		color: orisoInputColors.focus
	},
	'& .MuiInputLabel-root.Mui-error': {
		color: orisoInputColors.error
	},
	'& .MuiOutlinedInput-root': {
		'borderRadius': '4px',
		'backgroundColor': orisoInputColors.surfaceContainerLowest,
		'color': orisoInputColors.onSurface,
		'fontSize': '16px',
		'lineHeight': '24px',
		'letterSpacing': '0.5px',
		'minHeight': '56px',
		'transition':
			'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
		'& fieldset': {
			borderColor: orisoInputColors.outlineVariant
		},
		'&:hover fieldset': {
			borderColor: orisoInputColors.outline
		},
		'&.Mui-focused': {
			boxShadow: 'none'
		},
		'&.Mui-focused fieldset': {
			borderColor: orisoInputColors.focus,
			borderWidth: 3
		},
		'&.Mui-error fieldset': {
			borderColor: orisoInputColors.error,
			borderWidth: 3
		},
		'&.Mui-disabled': {
			backgroundColor: orisoInputColors.surfaceContainerLow,
			color: orisoInputColors.onSurfaceVariant
		},
		'&.Mui-disabled fieldset': {
			borderColor: orisoInputColors.outlineVariant
		},
		'&:has(input:-webkit-autofill)': {
			backgroundColor: orisoInputAutofill
		}
	},
	'& .MuiInputBase-input': {
		'height': '24px',
		'paddingTop': '16px',
		'paddingBottom': '16px',
		'paddingLeft': '16px',
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
	'& .MuiInputAdornment-positionStart': {
		marginLeft: '0',
		marginRight: '8px'
	},
	'& .MuiInputAdornment-positionEnd': {
		marginLeft: '8px',
		marginRight: '8px'
	},
	'& .MuiFormHelperText-root': {
		marginLeft: '16px',
		marginTop: '4px',
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.4px',
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiFormHelperText-root.Mui-error': {
		color: `${orisoInputColors.error} !important`
	}
} as const;

export const orisoSelectSx = {
	'mt': '20px',
	'& .MuiInputLabel-root': {
		color: orisoInputColors.onSurfaceVariant,
		fontSize: '16px',
		lineHeight: '24px',
		letterSpacing: '0.5px'
	},
	'& .MuiInputLabel-root.MuiInputLabel-shrink': {
		backgroundColor: orisoInputColors.surface,
		color: orisoInputColors.onSurfaceVariant,
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.4px',
		padding: '0 4px',
		transform: 'translate(12px, -7px) scale(1)'
	},
	'& .MuiInputLabel-root.Mui-focused': {
		color: orisoInputColors.focus
	},
	'& .MuiInputLabel-root.Mui-error': {
		color: orisoInputColors.error
	},
	'& .MuiOutlinedInput-root': {
		'minHeight': '56px',
		'borderRadius': '4px',
		'backgroundColor': orisoInputColors.surfaceContainerLowest,
		'fontSize': '16px',
		'lineHeight': '24px',
		'letterSpacing': '0.5px',
		'color': orisoInputColors.onSurface,
		'& fieldset': {
			borderColor: orisoInputColors.outlineVariant
		},
		'&:hover fieldset': {
			borderColor: orisoInputColors.outline
		},
		'&.Mui-focused fieldset': {
			borderColor: orisoInputColors.focus,
			borderWidth: 3
		},
		'&.Mui-error fieldset': {
			borderColor: orisoInputColors.error,
			borderWidth: 3
		},
		'&.Mui-disabled': {
			backgroundColor: orisoInputColors.surfaceContainerLow,
			color: orisoInputColors.onSurfaceVariant
		}
	},
	'& .MuiSelect-select': {
		minHeight: '24px',
		padding: '16px',
		display: 'flex',
		alignItems: 'center'
	},
	'& .MuiSelect-icon': {
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiCheckbox-root': {
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiCheckbox-root.Mui-checked': {
		color: orisoInputColors.primary
	},
	'& .orisoMultiSelectValue': {
		display: 'flex',
		flexWrap: 'wrap',
		gap: '6px'
	},
	'& .MuiFormHelperText-root': {
		marginLeft: '16px',
		marginTop: '4px',
		fontSize: '12px',
		lineHeight: '16px',
		letterSpacing: '0.4px',
		color: orisoInputColors.onSurfaceVariant
	},
	'& .MuiFormHelperText-root.Mui-error': {
		color: `${orisoInputColors.error} !important`
	}
} as const;

export const orisoSelectMenuProps = {
	sx: {
		zIndex: 10001
	},
	PaperProps: {
		sx: {
			'mt': '8px',
			'borderRadius': '8px',
			'border': `1px solid ${orisoInputColors.outlineVariant}`,
			'backgroundColor': orisoInputColors.surface,
			'boxShadow':
				'0 12px 24px rgba(27, 27, 28, 0.14), 0 2px 6px rgba(27, 27, 28, 0.08)',
			'& .MuiMenuItem-root': {
				minHeight: '48px',
				fontSize: '16px',
				lineHeight: '24px',
				letterSpacing: '0.5px',
				color: orisoInputColors.onSurface
			},
			'& .MuiMenuItem-root.Mui-selected': {
				backgroundColor: orisoInputColors.selectedLayer,
				color: orisoInputColors.primary
			},
			'& .MuiMenuItem-root.Mui-selected:hover, & .MuiMenuItem-root:hover':
				{
					backgroundColor: orisoInputColors.hoverLayer
				}
		}
	}
} as const;
