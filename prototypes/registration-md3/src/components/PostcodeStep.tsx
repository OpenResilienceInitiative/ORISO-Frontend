import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';

import StepHeading from './StepHeading';
import { md3 } from '../theme';

/**
 * Registration step 2 — postcode entry. Same design language as step 1
 * (MUI, M3 tokens). Digits-only, capped at 5 characters.
 *
 * The parent scroll area is left-anchored, so the whole step centres itself:
 * a centred column (maxWidth ~500, mx auto) with a location-pin accent badge,
 * centred heading/intro, and the "why" reasons in a soft surface-container box.
 */
export default function PostcodeStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        maxWidth: 500,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Soft circular location-pin accent above the heading */}
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: md3.surfaceContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
        }}
      >
        <PlaceRoundedIcon sx={{ fontSize: 32, color: md3.primary }} />
      </Box>

      <StepHeading title={t('reg.postcode.title')} />

      {/* "Why?" reasons in a calm surface-container info box */}
      <Box
        sx={{
          width: '100%',
          textAlign: 'start',
          bgcolor: md3.surfaceContainer,
          borderRadius: 3,
          px: 3,
          py: 2.5,
          mb: 4,
        }}
      >
        <Typography
          variant="body1"
          sx={{ color: md3.onSurface, fontWeight: 600, mb: 1 }}
        >
          {t('reg.postcode.whyIntro')}
        </Typography>
        <Box
          component="ul"
          sx={{
            m: 0,
            pl: 2.5,
            color: md3.onSurfaceVariant,
            '& li': { mb: 0.75 },
            '& li:last-of-type': { mb: 0 },
            '&::marker': { color: md3.primary },
            '& li::marker': { color: md3.primary },
          }}
        >
          <li>
            <Typography variant="body1" component="span">
              {t('reg.postcode.why1')}
            </Typography>
          </li>
          <li>
            <Typography variant="body1" component="span">
              {t('reg.postcode.why2')}
            </Typography>
          </li>
        </Box>
      </Box>

      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
        placeholder={t('reg.postcode.placeholder')}
        autoComplete="postal-code"
        inputProps={{
          inputMode: 'numeric',
          maxLength: 5,
          'aria-label': t('reg.postcode.placeholder'),
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PlaceRoundedIcon sx={{ color: md3.onSurfaceVariant }} />
            </InputAdornment>
          ),
          sx: { borderRadius: '12px', bgcolor: '#fff', fontSize: 17 },
        }}
        sx={{ width: '100%', maxWidth: 320 }}
      />
    </Box>
  );
}
