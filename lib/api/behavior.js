import {
    DefaultDraftBlockRenderMap,
    getDefaultKeyBinding,
    KeyBindingUtil,
} from 'draft-js';
import { filterEditorState } from 'draftjs-filters';

import {
    ENTITY_TYPE,
    BLOCK_TYPE,
    KEY_CODES,
    KEYBOARD_SHORTCUTS,
    CUSTOM_STYLE_MAP,
    INPUT_BLOCK_MAP,
    INPUT_ENTITY_MAP,
    DRAFT_MAX_DEPTH,
    MAX_SUPPORTED_LIST_NESTING,
} from '../api/constants';

const { hasCommandModifier, isOptionKeyCommand } = KeyBindingUtil;

// Hack relying on the internals of Draft.js.
// See https://github.com/facebook/draft-js/pull/869
const IS_MAC_OS = isOptionKeyCommand({ altKey: 'test' }) === 'test';

/**
 * Methods defining the behavior of the editor, depending on its configuration.
 */
export default {
    /**
     * Configure block render map from block types list.
     */
    getBlockRenderMap(blockTypes) {
        let renderMap = DefaultDraftBlockRenderMap;

        // Override default element for code block.
        // Fix https://github.com/facebook/draft-js/issues/406.
        if (blockTypes.some(block => block.type === BLOCK_TYPE.CODE)) {
            renderMap = renderMap.set(BLOCK_TYPE.CODE, {
                element: 'code',
                wrapper: DefaultDraftBlockRenderMap.get(BLOCK_TYPE.CODE)
                    .wrapper,
            });
        }

        blockTypes.filter(block => block.element).forEach(block => {
            renderMap = renderMap.set(block.type, {
                element: block.element,
            });
        });

        return renderMap;
    },

    /**
     * Configure block style function from block types list.
     */
    getBlockStyleFn(blockTypes) {
        const blockClassNames = {
            // Make it easy to style unstyled blocks, which are not configurable like other types.
            unstyled: 'Draftail-unstyled',
        };

        blockTypes.filter(block => block.className).forEach(block => {
            blockClassNames[block.type] = block.className;
        });

        const blockStyleFn = block => {
            const type = block.getType();
            const depth = block.getDepth();
            // Add depth classes that Draft.js doesn't provide.
            // See https://github.com/facebook/draft-js/blob/232791a4e92d94a52c869f853f9869367bdabdac/src/component/contents/DraftEditorContents-core.react.js#L58-L62.
            const depthClass =
                depth > 4
                    ? `Draftail-depth${depth} public-DraftStyleDefault-depth${
                          depth
                      }`
                    : '';
            let className = blockClassNames[type] || '';

            if (depthClass) {
                className = `${className} ${depthClass}`;
            }

            return className;
        };

        return blockStyleFn;
    },

    /**
     * Configure key binding function from enabled blocks, styles, entities.
     */
    getKeyBindingFn(blockTypes, inlineStyles, entityTypes) {
        // const getEnabledTypes = (activeTypes, allTypes) => {
        //     // Go through all the possible types, and check which are enabled.
        //     return Object.keys(allTypes).reduce((enabled, key) => {
        //         enabled[key] = activeTypes.some(
        //             item => item.type === allTypes[key],
        //         );

        //         return enabled;
        //     }, {});
        // };
        const getEnabled = activeTypes => {
            return activeTypes.reduce((enabled, type) => {
                enabled[type.type] = type.type;
                return enabled;
            }, {});
        };

        const blocks = getEnabled(blockTypes);
        const styles = getEnabled(inlineStyles);
        const entities = getEnabled(entityTypes);

        // Emits key commands to use in `handleKeyCommand` in `Editor`.
        const keyBindingFn = e => {
            // Safeguard that we only trigger shortcuts with exact matches.
            // eg. cmd + shift + b should not trigger bold.
            if (e.shiftKey) {
                // Key bindings supported by Draft.js must be explicitely discarded.
                // See https://github.com/facebook/draft-js/issues/941.
                switch (e.keyCode) {
                    case KEY_CODES.B:
                        return undefined;
                    case KEY_CODES.I:
                        return undefined;
                    case KEY_CODES.J:
                        return undefined;
                    case KEY_CODES.U:
                        return undefined;
                    case KEY_CODES.X:
                        return hasCommandModifier(e) && styles.STRIKETHROUGH;
                    case KEY_CODES[7]:
                        return (
                            hasCommandModifier(e) && blocks.ORDERED_LIST_ITEM
                        );
                    case KEY_CODES[8]:
                        return (
                            hasCommandModifier(e) && blocks.UNORDERED_LIST_ITEM
                        );
                    default:
                }
            } else {
                switch (e.keyCode) {
                    case KEY_CODES.K:
                        return hasCommandModifier(e) && entities.LINK;
                    case KEY_CODES.B:
                        return hasCommandModifier(e) && styles.BOLD;
                    case KEY_CODES.I:
                        return hasCommandModifier(e) && styles.ITALIC;
                    case KEY_CODES.J:
                        return hasCommandModifier(e) && styles.CODE;
                    case KEY_CODES.U:
                        return hasCommandModifier(e) && styles.UNDERLINE;
                    case KEY_CODES['.']:
                        return hasCommandModifier(e) && styles.SUPERSCRIPT;
                    case KEY_CODES[',']:
                        return hasCommandModifier(e) && styles.SUBSCRIPT;
                    case KEY_CODES[0]:
                        // Reverting to unstyled block is always available.
                        return (e.ctrlKey || e.metaKey) && e.altKey
                            ? BLOCK_TYPE.UNSTYLED
                            : null;
                    case KEY_CODES[1]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_ONE
                        );
                    case KEY_CODES[2]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_TWO
                        );
                    case KEY_CODES[3]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_THREE
                        );
                    case KEY_CODES[4]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_FOUR
                        );
                    case KEY_CODES[5]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_FIVE
                        );
                    case KEY_CODES[6]:
                        return (
                            (e.ctrlKey || e.metaKey) &&
                            e.altKey &&
                            blocks.HEADER_SIX
                        );
                    default:
                }
            }

            return getDefaultKeyBinding(e);
        };

        return keyBindingFn;
    },

    hasKeyboardShortcut(type) {
        return !!KEYBOARD_SHORTCUTS[type];
    },

    getKeyboardShortcut(type, isMacOS = IS_MAC_OS) {
        const shortcut = KEYBOARD_SHORTCUTS[type];
        const system = isMacOS ? 'macOS' : 'other';

        return (shortcut && shortcut[system]) || shortcut;
    },

    /**
     * Defines whether a block should be altered to a new type when
     * the user types a given mark.
     * This powers the "autolist" feature.
     *
     * Returns the new block type, or false if no replacement should occur.
     */
    handleBeforeInputBlockType(mark, blockTypes) {
        return blockTypes.find(b => b.type === INPUT_BLOCK_MAP[mark])
            ? INPUT_BLOCK_MAP[mark]
            : false;
    },

    handleBeforeInputHR(mark, block) {
        return (
            mark === INPUT_ENTITY_MAP[ENTITY_TYPE.HORIZONTAL_RULE] &&
            block.getType() !== BLOCK_TYPE.CODE
        );
    },

    getCustomStyleMap(inlineStyles) {
        const customStyleMap = {};

        inlineStyles.forEach(style => {
            if (style.style) {
                customStyleMap[style.type] = style.style;
            } else if (CUSTOM_STYLE_MAP[style.type]) {
                customStyleMap[style.type] = CUSTOM_STYLE_MAP[style.type];
            } else {
                customStyleMap[style.type] = {};
            }
        });

        return customStyleMap;
    },

    /**
     * Applies whitelist and blacklist operations to the editor content,
     * so the resulting editor state is shaped according to Draftail
     * expectations and configuration.
     */
    filterPaste(
        {
            maxListNesting,
            enableHorizontalRule,
            enableLineBreak,
            blockTypes,
            inlineStyles,
            entityTypes,
        },
        editorState,
    ) {
        const enabledEntityTypes = entityTypes.slice();
        const whitespacedCharacters = ['\t', '📷'];

        if (enableHorizontalRule) {
            enabledEntityTypes.push({
                type: ENTITY_TYPE.HORIZONTAL_RULE,
            });
        }

        if (!enableLineBreak) {
            whitespacedCharacters.push('\n');
        }

        return filterEditorState(
            {
                blocks: blockTypes.map(b => b.type),
                styles: inlineStyles.map(s => s.type),
                entities: enabledEntityTypes,
                maxNesting: maxListNesting,
                whitespacedCharacters,
            },
            editorState,
        );
    },

    /**
     * Generates CSS styles for list items
     */
    generateListNestingStyles(maxListNesting) {
        const minDepth = DRAFT_MAX_DEPTH + 1;
        const maxDepth = Math.min(maxListNesting, MAX_SUPPORTED_LIST_NESTING);
        let styles = '';

        for (let depth = minDepth; depth <= maxDepth; depth++) {
            const selector = `.Draftail-depth${depth}`;
            const counter = `ol${depth}`;
            const margin = 1.5 * (depth + 1);

            styles += `
            ${selector}.public-DraftStyleDefault-listLTR {
                margin-left: ${margin}em;
            }

            ${selector}.public-DraftStyleDefault-listRTL {
                margin-right: ${margin}em;
            }

            ${selector}.public-DraftStyleDefault-orderedListItem::before {
                content: counter(${counter}) '. ';
                counter-increment: ${counter};
            }

            ${selector}.public-DraftStyleDefault-reset {
                counter-reset: ${counter};
            }
            `.replace(/\s/g, '');
        }

        return styles || null;
    },
};
