/** Existing avatar measures, shared without restricting custom numeric sizes. */
export const AVATAR_SIZES = {
	compact: 24,
	default: 32,
	session: 40,
	message: 48,
	picker: 52,
	profile: 56,
	phone: 64,
	detail: 100,
	illustration: 108
} as const;

/** Maintained UserAvatar controls, plus the existing larger artwork previews. */
export const AVATAR_SIZE_OPTIONS = [
	24, 28, 32, 36, 40, 48, 52, 56, 64, 80, 100, 104, 108
] as const;
