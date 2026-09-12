import i18n from 'i18next';

export const callMediaErrorMessage = (mediaError: {
	name?: string;
	message?: string;
}): string => {
	const prefix = i18n.t('calls.error.cannotAccess');
	if (mediaError.name === 'NotAllowedError') {
		return `${prefix}${i18n.t('calls.error.grantPermissions')}`;
	}
	if (mediaError.name === 'NotFoundError') {
		return `${prefix}${i18n.t('calls.error.noDevice')}`;
	}
	if (mediaError.name === 'NotSupportedError') {
		return `${prefix}${i18n.t('calls.error.browserUnsupported')}`;
	}
	return `${prefix}${mediaError.message || i18n.t('calls.error.unknown')}`;
};
