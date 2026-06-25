import { createTheme } from '@mui/material/styles';

const getCssVarValue = (name, fallback = '#000000') => {
	// If you need a scss variable add a css variable for it in mui-variables-mapping.scss
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
	// Return fallback if value is empty (e.g., in Storybook where CSS vars might not be loaded)
	return value || fallback;
};

// A custom theme for this app. A factory because the --m3-* custom
// properties change at runtime when a tenant palette is injected
// (THB-05) — the MUI theme must be re-created from the new values.
const createAppTheme = () =>
	createTheme({
		breakpoints: {
			values: {
				xs: 0,
				sm: 520,
				md: 600,
				lg: 1200,
				xl: 1600
			}
		},
		palette: {
			primary: {
				dark: getCssVarValue('--m3-primary-hover', '#991b1b'),
				main: getCssVarValue('--m3-primary', '#dc2626'),
				light: getCssVarValue('--m3-surface-container-low', '#f3f4f6'),
				lighter: getCssVarValue(
					'--m3-surface-container-lowest',
					'#f9fafb'
				)
			},
			info: {
				main: getCssVarValue('--black', '#000000'),
				light: getCssVarValue('--m3-on-surface-variant', '#6b7280')
			},
			error: {
				main: getCssVarValue('--m3-error', '#ef4444')
			},
			success: {
				main: getCssVarValue('--m3-success', '#10b981')
			}
		},
		typography: {
			fontFamily: getCssVarValue(
				'--font-family-sans-serif',
				'"Inter Variable", Arial, sans-serif'
			),
			h1: {
				color: getCssVarValue('--black', '#000000'),
				letterSpacing: 'normal',
				fontSize: getCssVarValue('--font-size-h1'),
				lineHeight: '50px',
				fontWeight: getCssVarValue('--font-weight-medium'),
				fontFamily: getCssVarValue('--font-family-sans-serif')
			},
			h2: {
				color: getCssVarValue('--black', '#000000'),
				letterSpacing: 'normal',
				fontSize: getCssVarValue('--font-size-h2'),
				lineHeight: '38px',
				fontWeight: getCssVarValue('--font-weight-medium'),
				fontFamily: getCssVarValue('--font-family-sans-serif')
			},
			h3: {
				color: getCssVarValue('--black', '#000000'),
				letterSpacing: 'normal',
				fontSize: getCssVarValue('--font-size-h3'),
				lineHeight: '32px',
				fontWeight: getCssVarValue('--font-weight-medium'),
				fontFamily: getCssVarValue('--font-family-sans-serif')
			},
			h4: {
				color: getCssVarValue('--black', '#000000'),
				letterSpacing: 'normal',
				fontSize: getCssVarValue('--font-size-h4'),
				lineHeight: '26px',
				fontWeight: getCssVarValue('--font-weight-medium'),
				fontFamily: getCssVarValue('--font-family-sans-serif')
			},
			h5: {
				color: getCssVarValue('--black', '#000000'),
				letterSpacing: 'normal',
				fontSize: getCssVarValue('--font-size-h5'),
				lineHeight: '24px',
				fontWeight: getCssVarValue('--font-weight-medium'),
				fontFamily: getCssVarValue('--font-family-sans-serif')
			},
			body1: {
				fontFamily: getCssVarValue('--font-family-sans-serif'),
				color: getCssVarValue('--black', '#000000'),
				lineHeight: getCssVarValue('--line-height-primary'),
				fontSize: getCssVarValue('--font-size-primary')
			},
			body2: {
				fontFamily: getCssVarValue('--font-family-sans-serif'),
				color: 'black',
				fontSize: getCssVarValue('--font-size-tertiary'),
				lineHeight: '20px'
			},
			subtitle1: {
				fontFamily: getCssVarValue('--font-family-sans-serif'),
				color: 'black',
				fontSize: '20px',
				lineHeight: '28px'
			},
			subtitle2: {
				fontFamily: getCssVarValue('--font-family-sans-serif'),
				color: 'black',
				fontSize: '12px',
				lineHeight: '16px'
			}
		},
		components: {
			MuiLink: {
				styleOverrides: {
					root: {
						'&:hover': {
							color: getCssVarValue(
								'--m3-primary-hover',
								'#b91c1c'
							)
						}
					}
				}
			},
			MuiIconButton: {
				styleOverrides: {
					root: {
						'&:hover': {
							color: 'white'
						}
					}
				}
			},
			MuiButton: {
				styleOverrides: {
					root: {
						'fontFamily': getCssVarValue(
							'--font-family-sans-serif'
						),
						'fontSize': getCssVarValue('--font-size-primary'),
						'fontWeight': getCssVarValue('--font-weight-bold'),
						'lineHeight': '20px',
						'borderRadius': getCssVarValue(
							'--button-border-radius'
						),
						'&.Mui-disabled': {
							backgroundColor: 'rgba(0, 0, 0, 0.12)',
							color: 'rgba(0, 0, 0, 0.26)',
							cursor: 'not-allowed',
							pointerEvents: 'auto'
						}
					},
					contained: {
						'paddingTop': '14px',
						'paddingBottom': '14px',
						'borderRadius': getCssVarValue(
							'--button-border-radius'
						),
						'backgroundColor': 'primary.main',
						'textTransform': 'none',
						'outline': 'none',
						'color': getCssVarValue('--white', '#ffffff'),
						'boxShadow': 'none',
						'&:hover': {
							boxShadow: 'none',
							color: getCssVarValue('--white'),
							backgroundColor: getCssVarValue(
								'--m3-primary-hover',
								'#b91c1c'
							)
						},
						'&.Mui-disabled': {
							backgroundColor: 'rgba(0, 0, 0, 0.12)',
							color: 'rgba(0, 0, 0, 0.26)',
							cursor: 'not-allowed',
							pointerEvents: 'auto'
						}
					},
					outlined: {
						'paddingTop': '14px',
						'paddingBottom': '14px',
						'borderRadius': getCssVarValue(
							'--button-border-radius'
						),
						'textTransform': 'none',
						'&:hover': {
							backgroundColor: getCssVarValue(
								'--m3-primary-hover',
								'#b91c1c'
							),
							borderColor: getCssVarValue(
								'--m3-primary-hover',
								'#b91c1c'
							),
							color: getCssVarValue('--white')
						}
					}
				}
			},
			MuiTooltip: {
				styleOverrides: {
					tooltip: {
						lineHeight: '20px',
						fontSize: getCssVarValue('--font-size-tertiary'),
						color: getCssVarValue('--black', '#000000'),
						backgroundColor: getCssVarValue('--white', '#ffffff'),
						fontWeight: getCssVarValue('--font-weight-regular'),
						fontFamily: getCssVarValue('--font-family-sans-serif'),
						borderRadius: '4px',
						maxWidth: '270px',
						boxShadow: '0px 0px 10px 0px rgba(153,153,153,1)',
						padding: '17px 24px'
					},
					arrow: {
						color: getCssVarValue('--white', '#ffffff')
					}
				}
			}
		}
	});

export { createAppTheme };
export default createAppTheme();
