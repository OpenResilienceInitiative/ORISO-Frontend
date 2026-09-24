import * as React from 'react';
import { useTranslation } from 'react-i18next';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import './coModeratorHelpDialog.styles.scss';

interface CoModeratorHelpDialogProps {
	open: boolean;
	onClose: () => void;
}

/**
 * "How do I add co-moderators later?" (#1499, item 3).
 *
 * Opened from the co-moderator menu when nobody can be picked while the
 * circle is being created. The steps describe the path the code actually
 * offers after creation: Chat-Info → "Chatraum Einstellungen" → "Bearbeiten"
 * reopens this same settings form in edit mode (`CircleSettingsView` with
 * `editChatId`), and saving sends `consultantIds`, which UserService
 * reconciles into CO_MODERATOR participants
 * (`GroupChatParticipantReconciliationService`). The edit button is only
 * offered to the owner while the circle is not running
 * (`GroupChatInfo`: `isGroupChatOwner && !active`), which the note says.
 */
export const CoModeratorHelpDialog = ({
	open,
	onClose
}: CoModeratorHelpDialogProps) => {
	const { t: translate } = useTranslation();
	const steps = [
		translate('groupChat.circle.moderatorHelpDialog.step1'),
		translate('groupChat.circle.moderatorHelpDialog.step2'),
		translate('groupChat.circle.moderatorHelpDialog.step3')
	];

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			closeLabel={translate('app.close')}
			icon={<GroupAddOutlinedIcon />}
			title={translate('groupChat.circle.moderatorHelpDialog.title')}
			description={translate(
				'groupChat.circle.moderatorHelpDialog.description'
			)}
			actions={[
				{
					label: translate(
						'groupChat.circle.moderatorHelpDialog.close'
					),
					onClick: onClose,
					primary: true
				}
			]}
			data-testid="co-moderator-help-dialog"
		>
			<ol className="coModeratorHelp__steps">
				{steps.map((step) => (
					<li key={step}>{step}</li>
				))}
			</ol>
			<p className="coModeratorHelp__note">
				{translate('groupChat.circle.moderatorHelpDialog.note')}
			</p>
		</M3Dialog>
	);
};
