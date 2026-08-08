import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const insertionMarkerKey = new PluginKey<DecorationSet>(
	'oriso-insertion-marker'
);

/** Meta payload: `number` pins the marker at that position, `null` clears it. */
type InsertionMarkerMeta = number | null;

/**
 * A visible dot at the spot a voice message will be placed (#996).
 *
 * Recording a voice note does not type anything, so without a marker the user
 * has no idea where in their half-written message the recording is going to
 * land. The dot is a widget decoration rather than real content: it never
 * enters the document, never reaches the transport markup, and disappears the
 * moment the insertion is committed or cancelled.
 *
 * The position is mapped through every transaction, so the marker follows the
 * text if the user keeps typing before or after it.
 */
export const InsertionMarker = Extension.create({
	name: 'orisoInsertionMarker',

	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: insertionMarkerKey,
				state: {
					init: () => DecorationSet.empty,
					apply(transaction, current) {
						const meta = transaction.getMeta(insertionMarkerKey) as
							| InsertionMarkerMeta
							| undefined;

						if (meta === null) {
							return DecorationSet.empty;
						}

						if (typeof meta === 'number') {
							return DecorationSet.create(transaction.doc, [
								Decoration.widget(
									meta,
									() => {
										const dot =
											document.createElement('span');
										dot.className =
											'composerInsertionMarker';
										// Decorative: the announcement belongs
										// to the recording control, not here.
										dot.setAttribute('aria-hidden', 'true');
										return dot;
									},
									{ side: 1 }
								)
							]);
						}

						return current.map(
							transaction.mapping,
							transaction.doc
						);
					}
				},
				props: {
					decorations(state) {
						return insertionMarkerKey.getState(state);
					}
				}
			})
		];
	}
});
