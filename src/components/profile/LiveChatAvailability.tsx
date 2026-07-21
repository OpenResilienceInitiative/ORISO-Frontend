import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Headline } from '../headline/Headline';
import { Switch } from '../Switch';
import { Text } from '../text/Text';
import { Checkbox } from '../checkbox/Checkbox';
import {
	useLiveChatAvailable,
	useLiveChatViaSidebar
} from '../../utils/liveChatToggle';

export const LiveChatAvailability = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const [
		liveChatAvailable,
		setLiveChatAvailable,
		{ loading, pending, error }
	] = useLiveChatAvailable();
	const [liveChatViaSidebar, setLiveChatViaSidebar] = useLiveChatViaSidebar();

	const handleToggle = useCallback(
		async (checked: boolean) => {
			try {
				await setLiveChatAvailable(checked);
				if (checked) {
					navigate(
						'/sessions/consultant/sessionPreview?chip=liveChat'
					);
				}
			} catch {
				// Keep the backend-acknowledged state; the message below is localized.
			}
		},
		[navigate, setLiveChatAvailable]
	);

	return (
		<div id="liveChatAvailability" className="absenceForm">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.functions.liveChat.title')}
					semanticLevel="5"
				/>
			</div>
			<div className="generalInformation">
				<Text
					text={translate('profile.functions.liveChat.description')}
					type="infoLargeAlternative"
				/>
				{/* Original 1.0 availability toggle. When the consultant chooses
				    to control availability from the navigation rail (checkbox
				    below), this toggle is disabled — it then only mirrors the
				    current state, and the rail becomes the control. */}
				<div className="flex">
					<Switch
						className="mr--1"
						onChange={handleToggle}
						checked={liveChatAvailable}
						disabled={liveChatViaSidebar || loading || pending}
						aria-label={translate(
							'profile.functions.liveChat.toggleLabel'
						)}
					/>
					<Text
						text={translate(
							'profile.functions.liveChat.toggleLabel'
						)}
						type="standard"
					/>
					{error && (
						<Text
							text={translate(
								'error.statusCodes.500.description'
							)}
							type="standard"
						/>
					)}
				</div>
				{/* New preference: move the availability control into the nav
				    rail. See the description text for the exact behaviour. */}
				<div style={{ marginTop: '16px' }}>
					<Checkbox
						inputId="liveChatViaSidebar"
						name="liveChatViaSidebar"
						labelId="liveChatViaSidebarLabel"
						label={translate(
							'profile.functions.liveChat.viaSidebar.label'
						)}
						description={translate(
							'profile.functions.liveChat.viaSidebar.description'
						)}
						checked={liveChatViaSidebar}
						checkboxHandle={() =>
							setLiveChatViaSidebar(!liveChatViaSidebar)
						}
					/>
				</div>
			</div>
		</div>
	);
};
