export const getUsernameHelperTextKey = ({
	usernameHasError,
	usernameAvailabilityFailed,
	isUsernameAvailable,
	usernameAvailabilityChecked
}: {
	usernameHasError: boolean;
	usernameAvailabilityFailed: boolean;
	isUsernameAvailable: boolean;
	usernameAvailabilityChecked: boolean;
}) => {
	if (usernameAvailabilityFailed) {
		return 'registration.account.username.error.retry';
	}

	if (usernameHasError) {
		return isUsernameAvailable
			? 'registration.account.username.error.tooShort'
			: 'registration.account.username.error.unavailable';
	}

	if (usernameAvailabilityChecked && isUsernameAvailable) {
		return 'registration.account.username.success';
	}

	return 'registration.account.username.info';
};
