
# Better Format AI Assistant Responses (Markdown Rendering)

## Problem
The AI assistant returns markdown-formatted responses (with `###`, `**bold**`, `*` lists, etc.) but they are displayed as raw text using `whitespace-pre-wrap`. This makes responses hard to read.

## Solution
Add a lightweight inline markdown renderer component that converts common markdown patterns to styled HTML. No external library needed -- just a small helper function that handles:

- `### Heading` -> bold section titles
- `**bold**` -> `<strong>`
- `* item` / `- item` -> bullet list items
- Numbered lists (`1. item`) -> numbered items  
- Line breaks preserved naturally

## File Modified
- `src/components/ai/AiContextSidebar.tsx`

## Changes

1. Add a `SimpleMarkdown` component that takes a content string and renders it with basic formatting:
   - Split content by lines
   - Detect headings (`###`, `##`, `#`) and render as bold text with appropriate sizing
   - Detect list items (`* `, `- `, `1. `) and render with bullet/number styling
   - Apply inline bold (`**text**`) replacement within all text
   - Wrap everything in a styled container with proper spacing

2. Replace the plain `{msg.content}` render for assistant messages with `<SimpleMarkdown content={msg.content} />`

3. Remove `whitespace-pre-wrap` from assistant message bubbles (the markdown component handles spacing)
