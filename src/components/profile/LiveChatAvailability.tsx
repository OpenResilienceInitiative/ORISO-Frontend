import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Headline } from '../headline/Headline';
import { Switch } from '../Switch';
import { Text } from '../text/Text';
import { useLiveChatAvailable } from '../../utils/liveChatToggle';

export const LiveChatAvailability = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const [liveChatAvailable, setLiveChatAvailable] = useLiveChatAvailable();

	const handleToggle = useCallback(
		(checked: boolean) => {
			setLiveChatAvailable(checked);
			if (checked) {
				navigate('/sessions/consultant/sessionPreview?chip=liveChat');
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
				<div className="flex">
					<Switch
						className="mr--1"
						onChange={handleToggle}
						checked={liveChatAvailable}
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
				</div>
			</div>
		</div>
	);
};
