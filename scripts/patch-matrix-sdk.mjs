import { readFileSync, writeFileSync } from 'node:fs';

// Remove when the locked SDK releases media that arrives after answer() ends.
const sdkRoot = new URL('../node_modules/matrix-js-sdk/', import.meta.url);
const supportedVersion = '38.4.0';
const { version } = JSON.parse(
	readFileSync(new URL('package.json', sdkRoot), 'utf8')
);

if (version !== supportedVersion) {
	throw new Error(
		`Review the Matrix SDK answer patch for version ${version} (expected ${supportedVersion}).`
	);
}

const patches = [
	{
		path: 'src/webrtc/call.ts',
		before: `                const stream = await this.client.getMediaHandler().getUserMediaStream(answerWithAudio, answerWithVideo);
                this.waitForLocalAVStream = false;`,
		after: `                const mediaHandler = this.client.getMediaHandler();
                const stream = await mediaHandler.getUserMediaStream(answerWithAudio, answerWithVideo);
                this.waitForLocalAVStream = false;
                if (this.callHasEnded() && !this.successor) {
                    if (mediaHandler.userMediaStreams.includes(stream)) {
                        mediaHandler.stopUserMediaStream(stream);
                    }
                    return;
                }`
	},
	{
		path: 'lib/webrtc/call.js',
		before: `          var stream = yield _this9.client.getMediaHandler().getUserMediaStream(answerWithAudio, answerWithVideo);
          _this9.waitForLocalAVStream = false;`,
		after: `          var mediaHandler = _this9.client.getMediaHandler();
          var stream = yield mediaHandler.getUserMediaStream(answerWithAudio, answerWithVideo);
          _this9.waitForLocalAVStream = false;
          if (_this9.callHasEnded() && !_this9.successor) {
            if (mediaHandler.userMediaStreams.includes(stream)) {
              mediaHandler.stopUserMediaStream(stream);
            }
            return;
          }`
	}
];

// Validate both shipped files before changing either one.
const updates = patches.map(({ path, before, after }) => {
	const file = new URL(path, sdkRoot);
	const content = readFileSync(file, 'utf8');
	const originalMatches = content.split(before).length - 1;
	const patchedMatches = content.split(after).length - 1;

	if (originalMatches === 0 && patchedMatches === 1) {
		return { file, content, updated: content };
	}

	if (originalMatches !== 1 || patchedMatches !== 0) {
		throw new Error(`Unexpected Matrix SDK answer() code in ${path}.`);
	}

	return { file, content, updated: content.replace(before, after) };
});

for (const { file, content, updated } of updates) {
	if (content !== updated) {
		writeFileSync(file, updated);
	}
}
