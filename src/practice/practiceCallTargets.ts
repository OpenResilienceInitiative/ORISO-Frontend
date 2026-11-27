/** Tour anchors (`data-tour-target`) of the practice call (FE#2545). */
export const PRACTICE_CALL_TARGETS = {
	stage: 'practice-call-stage',
	mute: 'practice-call-mute',
	camera: 'practice-call-camera',
	minimise: 'practice-call-minimise',
	leave: 'practice-call-leave',
	/** The real dock while the practice call is minimised, and its way back. */
	dock: 'practice-call-dock',
	expand: 'practice-call-expand'
} as const;
