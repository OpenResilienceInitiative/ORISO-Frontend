import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { md3 } from '../theme';

/** Shared per-step heading (title + optional subtitle), used by every step. */
export default function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h4"
        sx={{
          fontSize: { xs: 24, md: 28 },
          fontWeight: 700,
          lineHeight: 1.25,
          color: md3.onSurface,
          mb: subtitle ? 1 : 0,
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" sx={{ color: md3.onSurfaceVariant }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
