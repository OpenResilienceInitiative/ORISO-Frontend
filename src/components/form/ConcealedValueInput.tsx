import * as React from 'react';
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState
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

/**
 * A field holds a secret when it is a password or asks for one (FE#2582).
 * autocomplete is a case-insensitive, space-separated token list, e.g.
 * "section-login one-time-code".
 */
export const isSecretField = (type?: string, autoComplete?: string) =>
	type === 'password' ||
	(autoComplete ?? '')
		.toLowerCase()
		.split(/\s+/)
		.some((token) => SECRET_AUTOCOMPLETE.has(token));

/**
 * Whether a field wrapper should render ConcealedValueInput. A one-way
 * latch: once a field was secret it stays concealed, because the
 * show-password toggle turns type "password" into "text" and the password
 * must not reach the HTML then either.
 */
export const useConcealedValue = (type?: string, autoComplete?: string) => {
	const isSecret = isSecretField(type, autoComplete);
	const [concealValue, setConcealValue] = useState(isSecret);
	if (isSecret && !concealValue) {
		setConcealValue(true);
	}
	return concealValue;
};

/**
 * A native input for secrets (passwords, one-time codes).
 *
 * React DOM copies the value of a controlled input into its HTML `value`
 * attribute on every keystroke, so a typed password would be readable in the
 * page HTML by extensions, session replay or DOM-capturing error reporters
 * (FE#2582). This input keeps the parent's `value` as the source of truth but
 * writes it only to the element's `.value` property, never to the attribute.
 * Without a `value` prop it is uncontrolled: it starts from `defaultValue`
 * (again via the property only) and leaves editing to the browser.
 */
export const ConcealedValueInput = forwardRef<
	HTMLInputElement,
	NativeInputProps
>(({ value, defaultValue, onChange, ...rest }, forwardedRef) => {
	const nodeRef = useRef<HTMLInputElement | null>(null);
	const committedValue = useRef('');
	const isInitialized = useRef(false);
	const isControlled = value != null;
	const nextValue = isControlled ? String(value) : '';

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
		const node = nodeRef.current;
		if (!node) return;
		if (isControlled) {
			committedValue.current = nextValue;
			if (node.value !== nextValue) {
				node.value = nextValue;
			}
		} else if (!isInitialized.current && defaultValue != null) {
			node.value = String(defaultValue);
		}
		isInitialized.current = true;
	});

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			onChange?.(event);
			if (!isControlled) return;
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
		[onChange, isControlled]
	);

	return <input {...rest} ref={nodeRef} onChange={handleChange} />;
});

ConcealedValueInput.displayName = 'ConcealedValueInput';
