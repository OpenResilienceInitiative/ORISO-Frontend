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
import { LIVE_CHAT_AVAILABILITY_LOSS_TEXT_KEYS } from '../app/useLiveChatAvailabilityLossNotice';
import { usePracticeLiveChatAvailability } from '../../practice/practiceLiveChatAvailability';

export const LiveChatAvailability = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	// While practising, the switch shows and flips a practice-only state
	// (FE#2545): no API call, no shared preference.
	const realAvailability = useLiveChatAvailable();
	const [
		liveChatAvailable,
		setLiveChatAvailable,
		{ loading, pending, error, lostReason }
	] = usePracticeLiveChatAvailability(realAvailability);
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
				{/* The tour points at this row, not the tall card: on a phone
				    the card is taller than the screen (FE#2342). */}
				<div
					className="flex"
					data-tour-target="livechat-availability-settings"
				>
					{/* The practice tour's anchor sits on the control the
					    counsellor actually uses: here, or on the rail. */}
					<span
						className="flex"
						data-tour-target={
							liveChatViaSidebar
								? undefined
								: 'livechat-availability-control'
						}
					>
						<Switch
							className="mr--1"
							onChange={handleToggle}
							checked={liveChatAvailable}
							disabled={liveChatViaSidebar || loading || pending}
							aria-label={translate(
								'profile.functions.liveChat.toggleLabel'
							)}
						/>
					</span>
					<Text
						text={translate(
							'profile.functions.liveChat.toggleLabel'
						)}
						type="standard"
					/>
					{lostReason ? (
						<Text
							text={translate(
								LIVE_CHAT_AVAILABILITY_LOSS_TEXT_KEYS[
									lostReason
								]
							)}
							type="standard"
						/>
					) : (
						error && (
							<Text
								text={translate(
									'error.statusCodes.500.description'
								)}
								type="standard"
							/>
						)
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
						checkboxHandle={() => {
							// Saved in the profile; on failure the hook rolls
							// the checkbox back to the stored value.
							setLiveChatViaSidebar(!liveChatViaSidebar).catch(
								() => undefined
							);
						}}
					/>
				</div>
			</div>
		</div>
	);
};
