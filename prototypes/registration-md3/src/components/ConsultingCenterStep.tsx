import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';

import StepHeading from './StepHeading';
import { md3 } from '../theme';

/** Static demo data — in production this list comes from the agency-search API
 *  (filtered by the selected topic + the postcode from the previous step). */
const CENTERS = [
	{ id: 'caritas-am-meer', name: 'Caritas am Meer' },
	{ id: 'caritasverband-wismar', name: 'Caritasverband Wismar' }
] as const;

/**
 * Registration step 3 — choose a consulting center. Same M3 design language as
 * the topic step (`TopicSelection`): a rounded card holding a single-select
 * radio list of text rows, divided by hairlines. Presentation-only and fully
 * controlled on `value`, so it can lift into the real ORISO-Frontend unchanged.
 */
export default function ConsultingCenterStep({
	value,
	onChange,
	postcode
}: {
	value: string | null;
	onChange: (id: string) => void;
	postcode: string;
}) {
	const { t } = useTranslation();

	return (
		<Box sx={{ maxWidth: 720 }}>
			<StepHeading title={t('reg.center.title')} />

			{/* Bold intro line echoing the "Warum?" intro on the postcode step. */}
			<Typography
				variant="body1"
				sx={{ fontWeight: 700, color: md3.onSurface, mb: 2 }}
			>
				{t('reg.center.intro', { postcode })}
			</Typography>

			<Box
				role="radiogroup"
				aria-label={t('reg.center.title')}
				sx={{
					border: `1px solid ${md3.outlineVariant}`,
					borderRadius: 4,
					overflow: 'hidden',
					backgroundColor: md3.surface
				}}
			>
				<List disablePadding>
					{CENTERS.map((center, idx) => {
						const selected = value === center.id;
						return (
							<Box key={center.id}>
								{idx > 0 && (
									<Divider component="li" sx={{ mx: 2 }} />
								)}
								<ListItemButton
									role="radio"
									aria-checked={selected}
									selected={selected}
									onClick={() => onChange(center.id)}
									sx={{
										px: 2,
										py: 1.5,
										alignItems: 'flex-start',
										gap: 1.75
									}}
								>
									<Radio
										checked={selected}
										tabIndex={-1}
										disableRipple
										inputProps={{ 'aria-hidden': true }}
										sx={{
											mt: -0.25,
											ml: -0.5,
											alignSelf: 'flex-start'
										}}
									/>
									<ListItemText
										primary={center.name}
										secondary={t('reg.center.advisesIn')}
										primaryTypographyProps={{
											variant: 'subtitle1',
											color: md3.onSurface
										}}
										secondaryTypographyProps={{
											variant: 'body2',
											color: md3.onSurfaceVariant
										}}
										sx={{ my: 0 }}
									/>
								</ListItemButton>
							</Box>
						);
					})}
				</List>
			</Box>
		</Box>
	);
}
