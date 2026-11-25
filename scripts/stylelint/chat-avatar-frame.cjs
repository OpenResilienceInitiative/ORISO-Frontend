const path = require('node:path');
const stylelint = require('stylelint');
const stylelintRequire = require('node:module').createRequire(
	require.resolve('stylelint')
);
const selectorParser = stylelintRequire('postcss-selector-parser');
const resolveNestedSelector = stylelintRequire(
	'postcss-resolve-nested-selector'
);

const ruleName = 'oriso/chat-avatar-frame';
const messages = stylelint.utils.ruleMessages(ruleName, {
	missing: 'Use the shared chat-avatar-frame mixin for this avatar frame.',
	override:
		'Keep avatar frame size, border and surface in the shared chat-avatar-frame mixin.'
});
const targets = {
	'src/components/message/message.styles.scss': {
		selector: '&__avatar',
		parent: '.messageItem'
	},
	'src/components/carimat/CarimatMessageFrame.styles.scss': {
		selector: '.carimatMessageFrame__avatar',
		parent: '.carimatMessageFrame'
	},
	'src/components/pseudonym/PseudonymCard.styles.scss': {
		selector: '.pseudonymCard__avatarFrame',
		parent: null
	}
};
const frameClass =
	/^(?:messageItem__avatar|carimatMessageFrame__avatar|pseudonymCard__avatarFrame)(?:--[\w-]+)?$/;
const mentionsFrame =
	/\.(?:messageItem__avatar|carimatMessageFrame__avatar|pseudonymCard__avatarFrame)/;

// A class in the last compound addresses the frame itself; a class to the
// left of a combinator only describes an ancestor (e.g. its child SVG).
const targetsFrame = (selector) => {
	const compound = [];
	selector.each((node) => {
		if (node.type === 'combinator') compound.length = 0;
		else compound.push(node);
	});
	return compound.some((node) =>
		node.type === 'class'
			? frameClass.test(node.value)
			: node.type === 'pseudo' &&
				(node.value === ':is' || node.value === ':where') &&
				(node.nodes || []).some(targetsFrame)
	);
};

// Stylelint already depends on both parsers. Resolve SCSS nesting before
// parsing, keeping commas inside :is() and attribute values intact.
const isFrameRule = (rule) =>
	rule.selectors.some((selector) =>
		resolveNestedSelector(selector, rule).some((resolved) => {
			if (!mentionsFrame.test(resolved)) return false;
			try {
				return selectorParser()
					.astSync(resolved)
					.nodes.some(targetsFrame);
			} catch {
				// If an interpolated selector cannot be parsed, fail closed for
				// a selector that names a protected frame.
				return true;
			}
		})
	);
const protectedProperty =
	/^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|box-sizing|background(?:-.+)?|border(?:-.+)?|box-shadow|outline(?:-.+)?)$/i;

module.exports = stylelint.createPlugin(
	ruleName,
	(enabled) => (root, result) => {
		if (!enabled) return;
		const filename = (root.source?.input.file || '')
			.split(path.sep)
			.join('/');
		const target = Object.entries(targets).find(([file]) =>
			filename.endsWith('/' + file)
		);
		let found = false;
		root.walkRules((rule) => {
			const selector = rule.selector.trim();
			const expected =
				target &&
				selector === target[1].selector &&
				(target[1].parent
					? rule.parent?.selector === target[1].parent
					: rule.parent?.type === 'root');
			if (expected) {
				found = true;
				if (
					!rule.nodes.some(
						(node) =>
							node.type === 'atrule' &&
							node.name === 'include' &&
							node.params.trim() === 'chat-avatar-frame'
					)
				) {
					stylelint.utils.report({
						ruleName,
						result,
						node: rule,
						message: messages.missing
					});
				}
			}
			if (!expected && !isFrameRule(rule)) return;
			rule.walkDecls((node) => {
				let ancestor = node.parent;
				while (ancestor && ancestor.type !== 'rule')
					ancestor = ancestor.parent;
				if (ancestor === rule && protectedProperty.test(node.prop)) {
					stylelint.utils.report({
						ruleName,
						result,
						node,
						message: messages.override
					});
				}
			});
			if (expected) {
				rule.walkRules((nested) => {
					if (!/::?(?:after|before)/.test(nested.selector)) return;
					nested.walkDecls((node) => {
						if (protectedProperty.test(node.prop))
							stylelint.utils.report({
								ruleName,
								result,
								node,
								message: messages.override
							});
					});
				});
			}
			rule.walkAtRules('include', (node) => {
				let ancestor = node.parent;
				while (ancestor && ancestor.type !== 'rule')
					ancestor = ancestor.parent;
				if (
					ancestor === rule &&
					node.params.trim() !== 'chat-avatar-frame'
				) {
					stylelint.utils.report({
						ruleName,
						result,
						node,
						message: messages.override
					});
				}
			});
		});
		if (target && !found)
			stylelint.utils.report({
				ruleName,
				result,
				node: root,
				message: messages.missing
			});
	}
);
module.exports.ruleName = ruleName;
module.exports.messages = messages;
