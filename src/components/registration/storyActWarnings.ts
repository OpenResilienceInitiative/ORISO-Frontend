/*
 * #1338: registration stories drive MUI buttons while Storybook's userEvent
 * holds the act environment. React 19 runs their transition and ripple
 * updates outside act's queue and warns — a test-harness artefact, not an app
 * error. Story verification fails on any console error, so these stories name
 * exactly the warnings they produce; any other or any extra one still fails.
 */
const ACT_WARNING =
	"An update to %s inside a test was not wrapped in act(...).\n\nWhen testing, code that causes React state updates should be wrapped into act(...):\n\nact(() => {\n  /* fire events that update state */\n});\n/* assert on the output */\n\nThis ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act";

export const actWarnings = (counts: Record<string, number>) =>
	Object.entries(counts).map(([component, count]) => ({
		kind: 'console-error' as const,
		message: `${ACT_WARNING} ${component}`,
		count
	}));

export const suspendedInAct = (count: number) => ({
	kind: 'console-error' as const,
	message:
		'A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)',
	count
});
