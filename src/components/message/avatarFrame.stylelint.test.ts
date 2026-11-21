import path from 'node:path';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vite-plus/test';

const plugin = path.join(
	process.cwd(),
	'scripts/stylelint/chat-avatar-frame.cjs'
);
const check = (code: string, file: string) =>
	stylelint.lint({
		code,
		codeFilename: path.join(process.cwd(), file),
		customSyntax: 'postcss-scss',
		config: {
			plugins: [plugin],
			rules: { 'oriso/chat-avatar-frame': true }
		}
	});

describe('shared chat avatar frame lint rule', () => {
	it.each([
		[
			'src/components/message/message.styles.scss',
			'.messageItem { &__avatar { @include chat-avatar-frame; } }'
		],
		[
			'src/components/carimat/CarimatMessageFrame.styles.scss',
			'.carimatMessageFrame { .carimatMessageFrame__avatar { @include chat-avatar-frame; } }'
		],
		[
			'src/components/pseudonym/PseudonymCard.styles.scss',
			'.pseudonymCard__avatarFrame { @include chat-avatar-frame; }'
		]
	])('accepts the shared frame in %s', async (file, code) => {
		expect((await check(code, file)).errored).toBe(false);
	});

	it('rejects a replacement or local frame override', async () => {
		const file = 'src/components/message/message.styles.scss';
		expect(
			(
				await check(
					'.messageItem { &__avatar { border: 2px solid grey; } }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.messageItem { &__avatar { @include chat-avatar-frame; width: 48px; } }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.messageItem { &__avatar { @include chat-avatar-frame; @media (min-width: 20px) { width: 30px; } } }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.messageItem { &__avatar { @include chat-avatar-frame; } } .messageItem__avatar { border: 0; }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.messageItem { &__avatar { @include chat-avatar-frame; box-shadow: 0 0 0 2px gray; } }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.messageItem { &__avatar { @include chat-avatar-frame; @include other-frame; } }',
					file
				)
			).errored
		).toBe(true);
		expect(
			(
				await check(
					'.other { &__avatar { @include chat-avatar-frame; } }',
					file
				)
			).errored
		).toBe(true);
		for (const override of [
			'.messageItem { &__avatar { @include chat-avatar-frame; } &__avatar--system { border: 2px solid red; } }',
			'.messageItem { &__avatar { @include chat-avatar-frame; &:focus-visible { border: 2px solid red; } } }',
			'.messageItem { &__avatar { @include chat-avatar-frame; &--system { border: 2px solid red; } } }',
			'.messageItem { &__avatar { @include chat-avatar-frame; &--system:focus-visible { border: 2px solid red; } } }',
			'.messageItem { &__avatar { @include chat-avatar-frame; &.custom { border: 2px solid red; } } }'
		])
			expect((await check(override, file)).errored).toBe(true);
		for (const override of [
			'.messageItem { &__avatar { border: 0; } }',
			'.messageItem { &__avatar--system { background: red; } }',
			'.messageItem { &__avatar--system:hover { border: 0; } }',
			'@mixin different-frame { border: 0; } .messageItem { &__avatar { @include different-frame; } }',
			'@mixin different-frame { border: 0; } .messageItem__avatar { @include different-frame; }'
		])
			expect(
				(
					await check(
						override,
						'src/components/session/session.styles.scss'
					)
				).errored
			).toBe(true);
	});
	it.each([
		'.carimatMessageFrame__avatar[data-state="active"] { border: 2px solid gray; }',
		'.carimatMessageFrame__avatar:is(:focus-visible, :hover) { border: 2px solid gray; }',
		'.carimatMessageFrame__avatar { inline-size: 24px; }',
		'.carimatMessageFrame__avatar { block-size: 24px; }',
		'.carimatMessageFrame__avatar { max-inline-size: 24px; }',
		'.carimatMessageFrame__avatar { max-width: 24px; }',
		'.carimatMessageFrame__avatar { &:is(:focus-visible, :hover) { border: 0; } }',
		':is(.carimatMessageFrame__avatar, .other) { border: 0; }'
	])('rejects a frame override in another stylesheet: %s', async (code) => {
		expect(
			(await check(code, 'src/components/session/session.styles.scss'))
				.errored
		).toBe(true);
	});

	it.each([
		'.carimatMessageFrame__avatar svg { width: 24px; }',
		'.carimatMessageFrame__avatar:is(:focus-visible, :hover) svg { border: 0; }',
		'.other:not(.carimatMessageFrame__avatar) { border: 0; }'
	])('allows unrelated descendants and exclusions: %s', async (code) => {
		expect(
			(await check(code, 'src/components/session/session.styles.scss'))
				.errored
		).toBe(false);
	});
});
