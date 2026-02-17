

# Fix: ScrollArea Not Scrolling in Bulk Email Dialog

## Problem

The dialog shows 10 out of 11 users with no visible scroll. The 11th user is cut off at the bottom because the `ScrollArea` height constraint isn't working properly with the table layout.

## Solution

Reduce the `max-h` on the `ScrollArea` to force scrolling when there are many rows, and ensure the dialog content layout properly constrains the scrollable area.

## Technical Details

### File: `src/components/BulkEmailDialog.tsx`

- Change `max-h-[50vh]` to `max-h-[45vh]` on the `ScrollArea` to ensure scroll kicks in earlier
- Add `overflow-hidden` to the `DialogContent` flex container to prevent content from overflowing instead of scrolling

