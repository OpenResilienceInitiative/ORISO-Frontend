import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Switch } from '../../Switch';
import { m3SnackbarColors } from '../../m3Snackbar/M3Snackbar';
import {
	admissionToKnock,
	CallAdmission,
	CallAdmissionStore,
	knockToAdmission
} from './callAdmission';

export interface CallAdmissionToggleProps {
	store: CallAdmissionStore;
}

/**
 * "Anklopfen" inside the running call (#1892, FE#1794 §3): on, guests wait
 * until the counsellor lets them in; off, they join directly. Same wording as
 * the per-link toggle of the share popover, because it is the same setting.
 *
 * The switch follows the store, not the click: it moves once the value is
 * stored, so it never shows a state the server did not accept.
 */
export const CallAdmissionToggle = ({ store }: CallAdmissionToggleProps) => {
	const { t } = useTranslation();
	const labelId = useId();
	const descriptionId = useId();
	const [admission, setAdmission] = useState<CallAdmission | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => store.watch(setAdmission), [store]);

	if (admission === null) return null;
	const knock = admissionToKnock(admission);

	const change = async (next: boolean) => {
		setSaving(true);
		try {
			await store.set(knockToAdmission(next));
		} catch {
			// The store kept the old value, and so does the switch.
		} finally {
			setSaving(false);
		}
	};

	return (
		<Box
			data-testid="call-admission-toggle"
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.5,
				backgroundColor: m3SnackbarColors.surface,
				color: m3SnackbarColors.onSurface,
				borderRadius: '12px',
				px: 2,
				py: 1
			}}
		>
			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Typography
					id={labelId}
					component="p"
					sx={{
						color: 'inherit',
						fontSize: 14,
						fontWeight: 500,
						lineHeight: '20px',
						letterSpacing: '0.1px',
						m: 0
					}}
				>
					{t('calls.admission.label')}
				</Typography>
				<Typography
					id={descriptionId}
					component="p"
					aria-live="polite"
					sx={{
						color: 'inherit',
						fontSize: 12,
						lineHeight: '16px',
						letterSpacing: '0.4px',
						m: 0
					}}
				>
					{knock ? t('calls.admission.on') : t('calls.admission.off')}
				</Typography>
			</Box>
			<Switch
				checked={knock}
				onChange={(next) => void change(next)}
				disabled={saving}
				aria-labelledby={labelId}
				aria-describedby={descriptionId}
				data-testid="call-admission-switch"
			/>
		</Box>
	);
};
