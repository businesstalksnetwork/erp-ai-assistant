

## Problem

AI assistant responses in the sidebar are cut off / not fully visible. The sidebar panel is 280-300px wide with `overflow-hidden`, and message bubbles use `max-w-[90%]` (~252px). Long content like tables, bullet points, and wrapped text gets clipped horizontally.

Two issues:

1. **Message bubble too constrained**: `max-w-[90%]` of a 280px sidebar = ~252px for content. Tables and long words overflow.
2. **No word wrapping / overflow handling**: The `SimpleMarkdown` component and message container don't handle overflow — text and tables spill out and get clipped by the parent `overflow-hidden`.

## Fix

### 1. `AiContextSidebar.tsx` — Message container (line 431)

Change assistant message styling from `max-w-[90%]` to `max-w-full` and add `overflow-x-auto break-words` so content wraps properly and tables can scroll horizontally within the bubble:

```tsx
// Before:
<div className={`max-w-[90%] rounded-md px-2 py-1.5 text-xs ${...}`}>

// After:
<div className={`rounded-md px-2 py-1.5 text-xs overflow-x-auto break-words ${
  msg.role === "user"
    ? "bg-primary text-primary-foreground whitespace-pre-wrap max-w-[85%]"
    : "bg-muted max-w-full"
}`}>
```

### 2. `SimpleMarkdown.tsx` — Table overflow (line 50)

The table wrapper already has `overflow-x-auto` which is good, but also add `word-break: break-word` to the root container:

```tsx
// Line 114 — root div:
<div ref={ref} className="space-y-0 break-words overflow-hidden">{elements}</div>
```

### 3. `SimpleMarkdown.tsx` — Paragraph text wrapping (line 110)

Add `break-words` class to paragraph elements to prevent long words/URLs from overflowing:

```tsx
<p key={i} className="my-0.5 break-words">{applyInlineBold(line)}</p>
```

These three small CSS changes ensure all AI responses render fully within the sidebar without clipping.

