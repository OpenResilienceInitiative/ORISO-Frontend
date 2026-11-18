import * as React from 'react';
import { useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button } from '@mui/material';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState/helpers/stateHelpers';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { KeepAccountDialog } from './KeepAccountDialog';

/**
 * UserService#1662: "Konto behalten" is offered to an asker whose account is
 * temporary, and only when the server says keeping will succeed
 * (`temporaryAccountKeepAllowed`: the guest entered under "Gast wählt"). A
 * server that does not say offers nothing.
 */
export const isKeepableTemporaryAccount = (
	userData: UserDataInterface | null | undefined
): boolean =>
	Boolean(
		userData?.temporaryAccount &&
			userData.temporaryAccountKeepAllowed === true &&
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
	);

/**
 * The keep-account dialog for any entry point (profile card, conversation
 * menu). A keep the server still refuses explains itself in the dialog. The
 * user data is refreshed when the dialog closes after a
 * kept account, so the success message stays readable and the hidden
 * functions come back afterwards.
 */
export const useKeepAccountDialog = () => {
	const { userData, reloadUserData } = useContext(UserDataContext);
	const [open, setOpen] = useState(false);
	const kept = useRef(false);
	const available = isKeepableTemporaryAccount(userData);

	const close = useCallback(() => {
		setOpen(false);
		if (kept.current) {
			kept.current = false;
			void reloadUserData?.();
		}
	}, [reloadUserData]);

	const dialog =
		open && userData ? (
			<KeepAccountDialog
				open
				userName={userData.userName}
				account={userData}
				onClose={close}
				onKept={() => {
					kept.current = true;
				}}
			/>
		) : null;

	return { available, openDialog: () => setOpen(true), dialog };
};

/** The profile card: what keeping means, and the button that opens the dialog. */
export const KeepAccountEntry = () => {
	const { t } = useTranslation();
	const { available, openDialog, dialog } = useKeepAccountDialog();
	if (!available && !dialog) return null;
	return (
		<div className="keepAccountEntry" data-testid="keep-account-entry">
			<div className="profile__content__title">
				<Headline
					text={t('guestAccountMode.keep.action')}
					semanticLevel="3"
					styleLevel="5"
				/>
				<Text
					text={t('guestAccountMode.keep.actionDescription')}
					type="standard"
					className="tertiary"
				/>
			</div>
			<Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
				<Button
					variant="contained"
					onClick={openDialog}
					sx={{ textTransform: 'none', borderRadius: '20px' }}
				>
					{t('guestAccountMode.keep.action')}
				</Button>
			</Box>
			{dialog}
		</div>
	);
};
