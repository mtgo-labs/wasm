/**
 * CodeMirror 6 theme matching the mtgo-wasm dark UI palette.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/** Editor chrome — background, cursor, selection, gutters. */
const chrome = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#e8eaf0',
    fontSize: '0.8rem',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
    lineHeight: '1.5',
  },
  '.cm-content': {
    caretColor: '#2aabee',
    padding: '0.6rem 0.75rem',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '&.cm-editor': {
    height: '100%',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(42, 171, 238, 0.18) !important',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#2aabee',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    display: 'none',
    border: 'none',
  },
  // Lint diagnostics
  '.cm-diagnostic': {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.75rem',
    color: '#f87171',
    borderLeft: '3px solid #f87171',
    padding: '2px 8px',
    margin: 0,
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #f87171',
    textDecorationSkipInk: 'none',
  },
  '.cm-panels': {
    backgroundColor: 'transparent',
    color: '#f87171',
  },
});

/** JSON syntax colors. */
const highlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: '#7dd3fc' },
  { tag: t.string, color: '#86efac' },
  { tag: t.number, color: '#fbbf24' },
  { tag: [t.bool, t.atom], color: '#2aabee' },
  { tag: t.keyword, color: '#2aabee' },
  { tag: [t.punctuation, t.separator], color: '#5d6478' },
  { tag: t.invalid, color: '#f87171' },
]);

/** Combined theme extension array. */
export const jsonTheme = [chrome, syntaxHighlighting(highlightStyle)];
