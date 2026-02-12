

# Move User Profile from Sidebar to Header

## What Changes

Move the user avatar, name, and dropdown menu from the sidebar footer to the right side of the header bar. Remove the user profile card from the sidebar entirely.

## Layout Change

```text
BEFORE:
  Header:  [SidebarTrigger | Breadcrumbs]              [NotificationBell]
  Sidebar Footer: [Settings group] [User profile card with dropdown]

AFTER:
  Header:  [SidebarTrigger | Breadcrumbs]    [NotificationBell] [Avatar + Name + Dropdown]
  Sidebar Footer: [Settings group only]
```

## File to Modify

**`src/layouts/TenantLayout.tsx`**

1. Remove the user profile card block (lines 310-346) from `SidebarFooter`
2. Move the user avatar + name + dropdown menu into the header, placed after `NotificationBell`
3. The dropdown keeps all existing items: My Account, Language toggle, Super Admin link, Logout
4. Avatar shows initials in a small circle, user name displayed next to it (hidden on small screens)
5. Dropdown opens downward (side="bottom") instead of upward since it's now in the header

## Technical Details

- The `userInitials`, `userName`, dropdown menu content, and all handlers (`handleLogout`, `setLocale`, `navigate`) already exist in the component -- just relocating the JSX
- Header right section becomes: `NotificationBell` + `Separator` + user avatar button with dropdown
- On mobile, the user name text is hidden (`hidden sm:block`) but the avatar circle always shows
- Dropdown alignment changes from `side="top" align="start"` to `side="bottom" align="end"`

