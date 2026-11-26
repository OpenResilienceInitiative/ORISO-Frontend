import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	type SideChatIntroKind,
	useSideChatIntroDismissed
} from './sideChatIntroPreference';

/**
 * "Nicht mehr einblenden" under the intro notice of a side chat. Drawn with
 * the Erstantwort organism's own action pill (`erstantwort__action`), the
 * same button every other Carimat-style notice uses — no new control.
 */
export const SideChatIntroDismissButton = ({
	kind
}: {
	kind: SideChatIntroKind;
}) => {
	const { t: translate } = useTranslation();
	const [, dismiss] = useSideChatIntroDismissed(kind);
	return (
		<button
			type="button"
			className="erstantwort__action"
			data-cy={`side-chat-intro-dismiss-${kind}`}
			onClick={dismiss}
		>
			{translate('chatStage.panel.dismissIntro')}
		</button>
	);
};
