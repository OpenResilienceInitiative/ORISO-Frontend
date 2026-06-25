interface MessageEncryptionModeInput {
	isE2eeEnabled: boolean;
	isMatrixSession: boolean;
	isAskerEnquiry: boolean;
}

interface MissingLegacyKeyGuardInput {
	usesLegacyE2ee: boolean;
	encrypted: boolean;
	hasKeyId: boolean;
}

export const shouldUseLegacyE2ee = ({
	isE2eeEnabled,
	isMatrixSession,
	isAskerEnquiry
}: MessageEncryptionModeInput): boolean =>
	isE2eeEnabled && !isMatrixSession && !isAskerEnquiry;

export const shouldBlockMissingLegacyE2eeKey = ({
	usesLegacyE2ee,
	encrypted,
	hasKeyId
}: MissingLegacyKeyGuardInput): boolean =>
	usesLegacyE2ee && encrypted && !hasKeyId;
