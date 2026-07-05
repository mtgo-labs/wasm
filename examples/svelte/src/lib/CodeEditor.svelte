<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { json, jsonParseLinter } from '@codemirror/lang-json';
  import { linter, lintGutter } from '@codemirror/lint';
  import { indentWithTab } from '@codemirror/commands';
  import { bracketMatching, foldGutter } from '@codemirror/language';
  import { jsonTheme } from './cm-theme';

  let {
    value = $bindable(''),
    readOnly = false,
    placeholderText = '',
  }: {
    value?: string;
    readOnly?: boolean;
    placeholderText?: string;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  onMount(() => {
    const extensions = [
      ...jsonTheme,
      json(),
      bracketMatching(),
      foldGutter(),
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      EditorState.allowMultipleSelections.of(true),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) value = u.state.doc.toString();
      }),
    ];

    if (placeholderText) {
      extensions.push(cmPlaceholder(placeholderText));
    }

    if (!readOnly) {
      extensions.push(linter(jsonParseLinter()));
    } else {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(lintGutter()); // won't show in readOnly but harmless
    }

    view = new EditorView({
      state: EditorState.create({ doc: value || '', extensions }),
      parent: host,
    });

    return () => view?.destroy();
  });

  // Sync external value → editor (skips if editor is the source of the change).
  let lastExternal = value;
  $effect(() => {
    if (view && value !== lastExternal) {
      const current = view.state.doc.toString();
      if (value !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          selection: view.state.selection,
        });
      }
    }
    lastExternal = value;
  });
</script>

<div bind:this={host} class="cm-host" class:readonly={readOnly}></div>

<style>
  .cm-host {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .cm-host:not(.readonly) :global(.cm-editor.cm-focused) {
    outline: none;
  }

  .cm-host:not(.readonly):focus-within {
    border-color: var(--accent);
  }

  .cm-host :global(.cm-editor) {
    max-height: 180px;
  }

  .cm-host :global(.cm-scroller) {
    overflow: auto;
  }

  .readonly :global(.cm-editor) {
    max-height: 400px;
  }
</style>
