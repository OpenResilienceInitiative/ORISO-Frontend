import React, { useState } from 'react';
import { Overlay } from '../overlay/Overlay';
import { subscriptionKeyLostOverlayItem } from '../session/subscriptionKeyLostHelper';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import { useTranslation } from 'react-i18next';

interface MasterKeyLostMessageProps {
	subscriptionKeyLost: boolean;
}

/** A persistent history notice, using the maintained inline snackbar surface. */
export const MasterKeyLostMessage: React.FC<MasterKeyLostMessageProps> = ({
	subscriptionKeyLost
}) => {
	const { t: translate } = useTranslation();
	const [overlayActive, setOverlayActive] = useState(false);

	return (
		<>
			<M3Snackbar
				placement="inline"
				role="status"
				message={translate(
					`e2ee.subscriptionKeyLost.message.${subscriptionKeyLost ? 'primary' : 'secondary'}`
				)}
				action={
					subscriptionKeyLost
						? undefined
						: {
								label: translate(
									'e2ee.subscriptionKeyLost.message.more'
								),
								onClick: () => setOverlayActive(true)
							}
				}
				actionOnOwnLine={!subscriptionKeyLost}
			/>
			{overlayActive && (
				<Overlay
					item={subscriptionKeyLostOverlayItem}
					handleOverlay={() => setOverlayActive(false)}
					handleOverlayClose={() => setOverlayActive(false)}
				/>
			)}
		</>
	);
};
