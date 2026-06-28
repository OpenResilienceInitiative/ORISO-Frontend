import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Security/2FA settings route (opens the 2FA setup dialog via router state). */
export const TWO_FACTOR_SETTINGS_PATH = '/profile/einstellungen/sicherheit';

/**
 * Navigate to the 2FA settings tab with the open-dialog flag. The 2FA nag, the
 * further-steps card, and the consultant profile all trigger this same
 * route + state contract — centralised here so a route/state change is one edit.
 * Pass `extraState` (e.g. `{ isEditMode: true }`) to merge additional nav state.
 */
export const useOpenTwoFactorSettings = () => {
	const navigate = useNavigate();
	return useCallback(
		(extraState?: Record<string, unknown>) =>
			navigate(TWO_FACTOR_SETTINGS_PATH, {
				state: { openTwoFactor: true, ...extraState }
			}),
		[navigate]
	);
};
