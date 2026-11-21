/**
 * #2237: the person agreed in the waiting room of an audio or video group.
 * That click is the browser's user gesture, so camera and microphone are
 * asked now and the call opens later without a prompt. Best effort: a
 * refusal or a device without camera never stops the waiting; the call then
 * starts with that device off. The stream is released at once.
 */
export const askCallDevicesWhileWaiting = (
	modality: string | null | undefined,
	mediaDevices: MediaDevices | undefined = globalThis.navigator?.mediaDevices
): void => {
	if (!mediaDevices?.getUserMedia) return;
	if (modality !== 'VIDEO' && modality !== 'AUDIO') return;
	void mediaDevices
		.getUserMedia({ audio: true, video: modality === 'VIDEO' })
		.then((stream) => stream.getTracks().forEach((track) => track.stop()))
		.catch(() => undefined);
};
