import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useTranslation } from 'react-i18next';

import App from './App';
import { createOrisoTheme } from './theme';
import i18n, { isRtl } from './i18n';
import './index.css';

function Root() {
  // Re-create the theme when the writing direction changes so MUI components
  // (and the document) follow LTR/RTL with the selected language.
  const { i18n: instance } = useTranslation();
  const direction = isRtl(instance.language || 'de') ? 'rtl' : 'ltr';
  const theme = useMemo(() => createOrisoTheme(direction), [direction]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

// Touch the i18n singleton so it initialises before first render.
void i18n;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
