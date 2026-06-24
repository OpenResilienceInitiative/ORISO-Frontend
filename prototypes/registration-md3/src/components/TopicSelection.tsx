import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

import { md3 } from '../theme';
import type { TopicCategory } from '../data/topics';

export interface TopicSelectionProps {
  categories: TopicCategory[];
  /** Currently selected topic id (`<categoryId>/<slug>`), or null. */
  value: string | null;
  onChange: (id: string) => void;
  /** Category id that is open on first render. Defaults to the first category. */
  defaultExpandedCategoryId?: string;
}

/**
 * Material 3 "expandable list" for the registration topic step.
 *
 * - Each category is an MUI `Accordion`, so the open/close uses MUI's built-in
 *   `Collapse` transition (the animation comes for free, nothing hand-rolled).
 * - Categories expand independently (more than one can be open at once), which
 *   matches the Figma where several groups are open.
 * - Selection is a single choice across *all* categories — radio semantics.
 *
 * The component is presentation-only and fully controlled on `value`, so it can
 * be dropped into the real ORISO-Frontend (React + MUI v5) unchanged.
 */
export default function TopicSelection({
  categories,
  value,
  onChange,
  defaultExpandedCategoryId,
}: TopicSelectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([defaultExpandedCategoryId ?? categories[0]?.id].filter(Boolean) as string[]),
  );

  const toggle = (categoryId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });

  // categoryId of the current selection → used for the "lives here" badge.
  const selectedCategoryId = useMemo(
    () => (value ? value.split('/')[0] : null),
    [value],
  );

  return (
    <Box role="radiogroup" aria-label={t('reg.question')} sx={{ display: 'grid', gap: 1.5 }}>
      {categories.map((category) => {
        const isOpen = expanded.has(category.id);
        const holdsSelection = selectedCategoryId === category.id;

        return (
          <Accordion
            key={category.id}
            expanded={isOpen}
            onChange={() => toggle(category.id)}
            disableGutters
            elevation={0}
            sx={{
              border: `1px solid ${md3.outlineVariant}`,
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: md3.surface,
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRoundedIcon sx={{ color: md3.onSurfaceVariant }} />}
              sx={{
                minHeight: 68,
                px: 2,
                background: `linear-gradient(100deg, ${md3.surfaceContainerHigh} 0%, ${md3.surfaceContainerLow} 90%)`,
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 1.5,
                  my: 1.25,
                },
              }}
            >
              <Avatar
                src={category.icon}
                alt=""
                // Black ring around the round category illustration (per Figma).
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: 'transparent',
                  border: '2px solid #1B1B1C',
                }}
              />
              <Typography variant="h6" sx={{ color: md3.onSurface, flex: 1 }}>
                {t(`category.${category.id}`)}
              </Typography>
              {holdsSelection && !isOpen && (
                <CheckCircleRoundedIcon
                  sx={{ color: md3.primary, fontSize: 20, mr: 0.5 }}
                  aria-hidden
                />
              )}
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
              <List disablePadding>
                {category.topics.map((topic, idx) => {
                  const selected = value === topic.id;
                  const isLast = idx === category.topics.length - 1;
                  return (
                    <Box key={topic.id}>
                      {idx > 0 && <Divider component="li" sx={{ mx: 2 }} />}
                      <ListItemButton
                        role="radio"
                        aria-checked={selected}
                        selected={selected}
                        onClick={() => onChange(topic.id)}
                        sx={{ px: 2, py: 1.5, alignItems: 'flex-start', gap: 1.75 }}
                      >
                        <Avatar
                          src={topic.icon}
                          alt=""
                          variant="rounded"
                          sx={{
                            // Bigger rounded-square topic icon (per Frank's version);
                            // still a clear "Quadrat", radius scaled to match.
                            width: 64,
                            height: 64,
                            // The last icon in a category echoes the card's rounded
                            // bottom-left corner (32px) so it "follows" the card shape.
                            borderRadius: isLast ? '12px 12px 12px 32px' : '12px',
                            bgcolor: 'transparent',
                            flexShrink: 0,
                          }}
                        />
                        <ListItemText
                          primary={t(`topic.${topic.slug}.title`)}
                          secondary={t(`topic.${topic.slug}.desc`)}
                          primaryTypographyProps={{
                            variant: 'subtitle1',
                            color: md3.onSurface,
                          }}
                          secondaryTypographyProps={{
                            variant: 'body2',
                            color: md3.onSurfaceVariant,
                          }}
                          sx={{ my: 0 }}
                        />
                        <Radio
                          checked={selected}
                          tabIndex={-1}
                          disableRipple
                          edge="end"
                          inputProps={{ 'aria-hidden': true }}
                          sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                        />
                      </ListItemButton>
                    </Box>
                  );
                })}
              </List>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
