import * as React from 'react';
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useRef
} from 'react';

type NativeInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Autocomplete tokens that mark a field whose content is a secret.
 */
const SECRET_AUTOCOMPLETE = new Set([
	'current-password',
	'new-password',
	'one-time-code'
]);

/** A field holds a secret when it is a password or asks for one (FE#2582). */
export const isSecretField = (type?: string, autoComplete?: string) =>
	type === 'password' ||
	(autoComplete !== undefined && SECRET_AUTOCOMPLETE.has(autoComplete));

/**
 * A native input for secrets (passwords, one-time codes).
 *
 * React DOM copies the value of a controlled input into its HTML `value`
 * attribute on every keystroke, so a typed password would be readable in the
 * page HTML by extensions, session replay or DOM-capturing error reporters
 * (FE#2582). This input keeps the parent's `value` as the source of truth but
 * writes it only to the element's `.value` property, never to the attribute.
 */
export const ConcealedValueInput = forwardRef<
	HTMLInputElement,
	NativeInputProps
>(({ value, defaultValue: _defaultValue, onChange, ...rest }, forwardedRef) => {
	const nodeRef = useRef<HTMLInputElement | null>(null);
	const committedValue = useRef('');
	const nextValue = value == null ? '' : String(value);

	// SAFETY: React runs this after the <input> below mounted, so nodeRef is set.
	useImperativeHandle(
		forwardedRef,
		() => nodeRef.current as HTMLInputElement,
		[]
	);

	// Runs after every commit, not only when the value changed: a DOM-only
	// change (form.reset(), a rejected keystroke) must not leave the field
	// showing something other than the parent's state.
	useLayoutEffect(() => {
		committedValue.current = nextValue;
		const node = nodeRef.current;
		if (node && node.value !== nextValue) {
			node.value = nextValue;
		}
	});

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			onChange?.(event);
			// A controlled input snaps back when the parent rejects a
			// keystroke. React flushes the parent's update before this
			// microtask, so whatever value it committed is the one to show.
			// This assumes the parent sets its state synchronously in
			// onChange; a parent that updates later (debounce, await) would
			// see its keystroke undone until that update arrives.
			queueMicrotask(() => {
				const node = nodeRef.current;
				if (node && node.value !== committedValue.current) {
					node.value = committedValue.current;
				}
			});
		},
		[onChange]
	);

	return <input {...rest} ref={nodeRef} onChange={handleChange} />;
});

ConcealedValueInput.displayName = 'ConcealedValueInput';
