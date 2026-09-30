import * as React from 'react';
import { Dispatch, ReactElement, SetStateAction } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StageLayout } from '../../stageLayout/StageLayout';
import { AccountData } from '../accountData/AccountData';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { RegistrationHandover } from '../../app/registrationLoader/RegistrationHandover';
import type { RegistrationData } from '../../../globalState';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';

/**
 * The newcomer entry of a self-help group link, as designed in Storybook
 * ("Group chat/Self-help entry room" 0a/0b): no steps, no chips, no agency
 * box — the link already carries all three. Only the name is asked, and by
 * default without a password (temporary join).
 */
export const GroupInviteEntry = ({
	stage,
	gcid,
	aid,
	temporary,
	onToggleTemporary,
	onChange,
	onJoin,
	joinDisabled,
	busy
}: {
	stage: ReactElement;
	gcid: string;
	aid: string;
	temporary: boolean;
	onToggleTemporary: () => void;
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
	onJoin: () => void;
	joinDisabled: boolean;
	busy: boolean;
}) => {
	const { t } = useTranslation();

	return (
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showLoginLink={true}
			showRegistrationLink={false}
			loginParams={new URLSearchParams({ gcid, aid }).toString()}
			loginState={INVITE_LOGIN_STATE}
			stage={stage}
			mobileHero="bar"
		>
			{busy ? (
				<RegistrationHandover
					ready={false}
					forcedState="preparing"
					variant="inline"
					onEnter={() => undefined}
				/>
			) : (
				<Box
					data-cy="group-invite-entry"
					sx={{
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
						px: { xs: 2.5, sm: 5 },
						pt: { xs: 3, sm: 4 },
						pb: { xs: '128px', sm: '136px' }
					}}
				>
					<AccountData
						onChange={onChange}
						entry="link"
						temporary={temporary}
					/>
					<RegistrationFooter
						secondary={{
							label: temporary
								? t(
										'registration.account.temporary.toggleOff',
										'Konto anlegen'
									)
								: t(
										'registration.account.temporary.toggleOn',
										'Ohne Konto beitreten'
									),
							onClick: onToggleTemporary
						}}
						primary={{
							label: temporary
								? t(
										'registration.account.temporary.joinGroup',
										'Der Gruppe beitreten'
									)
								: t('registration.register'),
							onClick: onJoin,
							disabled: joinDisabled
						}}
					/>
				</Box>
			)}
		</StageLayout>
	);
};
