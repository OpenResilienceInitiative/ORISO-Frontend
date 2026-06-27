import { createTheme } from '@mui/material/styles';

// Material 3 colour roles taken from the Figma file (App.Oriso · node 7642-31346)
// plus a *toned-down* Caritas red. The stock Caritas red is quite "candy"; the
// ORISO design direction is a muted, lower-chroma scheme, so the hero and the
// primary action use a desaturated brick red rather than the pure signal red.
export const md3 = {
  onSurface: '#1B1B1C',
  onSurfaceVariant: '#444748',
  outline: '#74777B',
  outlineVariant: '#C4C7C8',
  surface: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F4F4',
  surfaceContainer: '#F1EEEE',
  surfaceContainerHigh: '#EBE8E8',
  secondary: '#4C555F',
  secondaryContainer: '#E8EBEE',
  onSecondaryContainer: '#39424B',
  primary: '#A4262E',
  primaryDark: '#7E1D23',
  // selected-row state layer (faint primary tint)
  selectedLayer: 'rgba(164, 38, 46, 0.08)',
  hoverLayer: 'rgba(27, 27, 28, 0.04)',
  // classic Caritas CI red (matches the partner-logo red #CC1E1C)
  caritasRed: '#CC1E1C',
  // hero gradient — classic Caritas red, bright top-left → deep bottom
  heroGradient: 'linear-gradient(152deg, #DA2530 0%, #C0121F 46%, #7C0D15 100%)',
} as const;

export const createOrisoTheme = (direction: 'ltr' | 'rtl') =>
  createTheme({
    direction,
    palette: {
      mode: 'light',
      primary: { main: md3.primary, dark: md3.primaryDark, contrastText: '#FFFFFF' },
      secondary: { main: md3.secondary, contrastText: '#FFFFFF' },
      text: { primary: md3.onSurface, secondary: md3.onSurfaceVariant },
      divider: md3.outlineVariant,
      background: { default: '#FFFFFF', paper: '#FFFFFF' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      // M3 Title Large (emphasized) — category headers
      h6: { fontSize: 20, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 },
      // M3 Body Large (emphasized) — topic titles
      subtitle1: { fontSize: 16, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0.1 },
      // M3 Body Medium — topic descriptions (Roboto in the spec)
      body2: {
        fontFamily: '"Roboto", "Inter", sans-serif',
        fontSize: 14,
        lineHeight: 1.43,
        letterSpacing: 0.2,
      },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.1 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 24 },
          sizeLarge: { paddingBlock: 12, paddingInline: 32, fontSize: 16 },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            '&::before': { display: 'none' },
            '&.Mui-expanded': { margin: 0 },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': { backgroundColor: md3.selectedLayer },
            '&.Mui-selected:hover': { backgroundColor: md3.selectedLayer },
          },
        },
      },
      MuiRadio: {
        styleOverrides: { root: { color: md3.outline } },
      },
    },
  });
