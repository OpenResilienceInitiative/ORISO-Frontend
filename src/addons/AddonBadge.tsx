import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { badgeText } from './addonLink';
import './addons.styles';

/** The count an add-on app reports; `decorative` when the parent already names it. */
export const AddonBadge = ({
	badge,
	decorative = false
}: {
	badge?: number;
	decorative?: boolean;
}) => {
	const { t: translate } = useTranslation();
	const text = badgeText(badge);
	if (!text) {
		return null;
	}
	return decorative ? (
		<span className="addonBadge" aria-hidden="true">
			{text}
		</span>
	) : (
		<span
			className="addonBadge"
			role="img"
			aria-label={translate('addons.badge', { count: badge })}
		>
			{text}
		</span>
	);
};
