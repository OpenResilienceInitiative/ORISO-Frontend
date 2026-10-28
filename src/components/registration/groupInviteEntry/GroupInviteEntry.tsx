import * as React from 'react';
import { Dispatch, ReactElement, SetStateAction } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StageLayout } from '../../stageLayout/StageLayout';
import { AccountData } from '../accountData/AccountData';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import type { RegistrationData } from '../../../globalState';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';
import { RegistrationCompletionProvider } from '../consentCompletion/RegistrationCompletionContext';
import { GroupHeading } from '../../groupChat/entryRoom/GroupHeading';

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
	busy,
	agencyName
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
	/** The agency the link names; the waiting room shows the same (#1689). */
	agencyName?: string;
}) => {
	const { t } = useTranslation();
	/* Only the agency: the topic stays hidden until the privacy agreement
	   is recorded, as in the waiting room (#1499). */
	const heading = <GroupHeading agencyName={agencyName} textAlign="left" />;

	return (
		<RegistrationCompletionProvider>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={true}
				showRegistrationLink={false}
				loginParams={new URLSearchParams({ gcid, aid }).toString()}
				loginState={INVITE_LOGIN_STATE}
				stage={stage}
				mobileHero="bar"
				headerStart={heading}
			>
				{/* Once `busy`, `Registration` swaps this whole screen for the
				    shared waiting room (`WaitingRoomFrame`, #1219). */}
				<Box
					data-cy="group-invite-entry"
					sx={{
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
						px: { xs: 2.5, sm: 5 },
						pt: { xs: 3, sm: 4 },
						pb: 2
					}}
				>
					{agencyName && (
						<Box
							sx={{
								display: { xs: 'block', lg: 'none' },
								mb: 1.5
							}}
						>
							{heading}
						</Box>
					)}
					<AccountData
						onChange={onChange}
						entry="link"
						temporary={temporary}
					/>
					<RegistrationFooter
						secondary={{
							compact: true,
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
							onClick: () => {
								if (!joinDisabled && !busy) onJoin();
							},
							disabled: joinDisabled || busy
						}}
					/>
				</Box>
			</StageLayout>
		</RegistrationCompletionProvider>
	);
};
