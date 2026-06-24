import { useEffect, useRef } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { md3 } from '../theme';

// Registration flow: Fokus → Postleitzahl → Beratungsstelle → Registrieren → Anfrage.
const STEPS: { key: string; Icon: SvgIconComponent }[] = [
  { key: 'fokus', Icon: CenterFocusStrongRoundedIcon },
  { key: 'plz', Icon: PlaceRoundedIcon },
  { key: 'beratungsstelle', Icon: ApartmentRoundedIcon },
  { key: 'registrieren', Icon: HowToRegRoundedIcon },
  { key: 'anfrage', Icon: ChatBubbleRoundedIcon },
];

/**
 * Prominent, icon-based registration stepper.
 * - Completed connectors are solid, upcoming ones dotted.
 * - Steps already reached (`<= maxStep`) are clickable to navigate back/forth.
 * - On mobile the row scrolls horizontally; the active step is kept in view.
 */
export default function RegistrationStepper({
  current,
  total,
  maxStep = current,
  onStepClick,
}: {
  current: number; // 1-based
  total: number;
  maxStep?: number; // highest step reached (clickable up to here)
  onStepClick?: (step: number) => void;
}) {
  const { t } = useTranslation();
  const steps = STEPS.slice(0, total);
  const doneCount = current - 1;
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current]);

  return (
    <Box>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: md3.onSurfaceVariant,
          mb: 1,
        }}
      >
        {t('reg.title')}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          overflowX: { xs: 'auto', sm: 'visible' },
          pb: { xs: 0.5, sm: 0 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {steps.map((stepItem, i) => {
          const done = i < doneCount;
          const active = i === doneCount;
          const stepNumber = i + 1;
          const clickable = Boolean(onStepClick) && stepNumber <= maxStep;
          const { Icon } = stepItem;
          return (
            <Box key={stepItem.key} sx={{ display: 'contents' }}>
              {/* step node */}
              <Box
                ref={active ? activeRef : undefined}
                onClick={clickable ? () => onStepClick!(stepNumber) : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-current={active ? 'step' : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onStepClick!(stepNumber);
                        }
                      }
                    : undefined
                }
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  width: { xs: 80, sm: 76 },
                  flexShrink: 0,
                  cursor: clickable ? 'pointer' : 'default',
                  borderRadius: 2,
                  outline: 'none',
                  '&:focus-visible': { boxShadow: `0 0 0 2px ${md3.primary}` },
                  '&:hover .step-dot': clickable ? { transform: 'scale(1.06)' } : {},
                }}
              >
                <Box
                  className="step-dot"
                  sx={{
                    width: { xs: 34, sm: 40 },
                    height: { xs: 34, sm: 40 },
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all .25s ease',
                    bgcolor: done || active ? 'primary.main' : md3.surfaceContainerHigh,
                    color: done || active ? '#fff' : md3.onSurfaceVariant,
                    border: done || active ? 'none' : `1.5px solid ${md3.outlineVariant}`,
                    boxShadow: active ? `0 0 0 4px ${md3.selectedLayer}` : 'none',
                  }}
                >
                  {done ? (
                    <CheckRoundedIcon sx={{ fontSize: { xs: 18, sm: 22 } }} />
                  ) : (
                    <Icon sx={{ fontSize: { xs: 18, sm: 22 } }} />
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: { xs: 10.5, sm: 12 },
                    fontWeight: active ? 700 : 500,
                    color: active ? 'primary.main' : done ? md3.onSurface : md3.onSurfaceVariant,
                    lineHeight: 1.15,
                    textAlign: 'center',
                  }}
                >
                  {t(`reg.stepNames.${stepItem.key}`)}
                </Typography>
              </Box>

              {/* connector — solid when the preceding step is done, dotted otherwise */}
              {i < steps.length - 1 && (
                <Box
                  sx={{
                    flexGrow: 1,
                    flexShrink: 0,
                    minWidth: { xs: 20, sm: 24 },
                    mt: { xs: '16px', sm: '19px' },
                    mx: 0.5,
                    borderTop: done
                      ? `3px solid ${md3.primary}`
                      : `2.5px dotted ${md3.outlineVariant}`,
                    transition: 'border-color .25s ease',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
