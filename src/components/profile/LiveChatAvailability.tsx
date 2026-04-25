import * as React from 'react';
import { useCallback } from 'react';
import Switch from 'react-switch';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { useLiveChatAvailable } from '../../utils/liveChatToggle';

export const LiveChatAvailability = () => {
	const { t: translate } = useTranslation();
	const history = useHistory();
	const [liveChatAvailable, setLiveChatAvailable] = useLiveChatAvailable();

	const handleToggle = useCallback(
		(checked: boolean) => {
			setLiveChatAvailable(checked);
			if (checked) {
				history.push(
					'/sessions/consultant/sessionPreview?chip=liveChat'
				);
			}
		},
		[history, setLiveChatAvailable]
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
						uncheckedIcon={false}
						checkedIcon={false}
						width={48}
						height={26}
						onColor="#0A882F"
						offColor="#8C878C"
						boxShadow="0px 1px 4px rgba(0, 0, 0, 0.6)"
						handleDiameter={27}
						activeBoxShadow="none"
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
