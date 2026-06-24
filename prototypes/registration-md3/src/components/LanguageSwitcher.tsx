import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

import { SUPPORTED_LANGUAGES } from '../i18n';
import { md3 } from '../theme';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const current = (i18n.language || 'de').split('-')[0];

  const choose = (code: string) => {
    i18n.changeLanguage(code);
    setAnchor(null);
  };

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={<LanguageRoundedIcon />}
        endIcon={<KeyboardArrowDownRoundedIcon />}
        aria-label={t('reg.language')}
        sx={{
          color: md3.onSurfaceVariant,
          fontWeight: 500,
          borderRadius: 999,
          px: 1.5,
        }}
      >
        ({current.toUpperCase()}) {t(`lang.${current}`)}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 3, minWidth: 200, mt: 0.5 } } }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <MenuItem key={code} selected={code === current} onClick={() => choose(code)}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {code === current && <CheckRoundedIcon fontSize="small" sx={{ color: md3.primary }} />}
            </ListItemIcon>
            <ListItemText primary={t(`lang.${code}`)} secondary={code.toUpperCase()} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
