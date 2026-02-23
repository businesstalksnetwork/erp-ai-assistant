
# Enhance Opportunity Detail: Documents, Chat, Activity, Tags

## Overview

Transform the Opportunity Detail page from a simple info view into a full-featured deal workspace with tabbed sections for Documents, Internal Chat, Activity Log, and User Tagging. This turns each opportunity into a collaborative hub where the sales team can work together.

## New Database Tables

### 1. `opportunity_documents` -- Files attached to opportunities
- `id` uuid PK
- `tenant_id` uuid FK tenants
- `opportunity_id` uuid FK opportunities
- `file_name` text
- `file_path` text (path in storage bucket)
- `file_size` bigint
- `mime_type` text
- `uploaded_by` uuid (references profiles)
- `created_at` timestamptz

### 2. `opportunity_comments` -- Internal chat/discussion thread
- `id` uuid PK
- `tenant_id` uuid FK tenants
- `opportunity_id` uuid FK opportunities
- `user_id` uuid (references profiles)
- `content` text (supports @mentions as `@[user_id]`)
- `parent_id` uuid (nullable, for threaded replies)
- `created_at` timestamptz
- `updated_at` timestamptz

### 3. `opportunity_activities` -- Automatic activity/audit log
- `id` uuid PK
- `tenant_id` uuid FK tenants
- `opportunity_id` uuid FK opportunities
- `user_id` uuid
- `activity_type` text (stage_change, document_uploaded, comment_added, meeting_scheduled, quote_created, tag_added, etc.)
- `description` text
- `metadata` jsonb
- `created_at` timestamptz

### 4. `opportunity_tags` -- Tags/labels on opportunities
- `id` uuid PK
- `tenant_id` uuid FK tenants
- `opportunity_id` uuid FK opportunities
- `tag` text (e.g. "urgent", "enterprise", "follow-up")
- `color` text (hex)
- `created_by` uuid
- `created_at` timestamptz
- UNIQUE(opportunity_id, tag)

### 5. `opportunity_followers` -- Users "following" an opportunity (for notifications/tagging)
- `id` uuid PK
- `tenant_id` uuid FK tenants
- `opportunity_id` uuid FK opportunities
- `user_id` uuid
- `created_at` timestamptz
- UNIQUE(opportunity_id, user_id)

All tables get RLS using `tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))`.

### Storage
Use the existing `tenant-documents` bucket for opportunity file uploads (files stored under `opportunities/{opportunity_id}/` prefix).

## UI Changes to OpportunityDetail.tsx

Reorganize the page into a tabbed layout:

```text
+-------------------------------------------------------+
| <- Back   "Opportunity Title"   [Stage Badge]  [Tags] |
|                                                        |
| [Stage progression buttons]                            |
|                                                        |
| +-- Info --+-- Dokumenti --+-- Diskusija --+-- Aktivnost --+
| |                                                      |
| | (Tab content below)                                  |
| |                                                      |
+-------------------------------------------------------+
```

### Tab 1: Pregled (Overview) -- existing content
- Deal info card (value, probability, contact, dates, partners)
- Actions card (Create Quote, Schedule Meeting)
- Meetings table
- Followers/assigned users with ability to tag/add team members

### Tab 2: Dokumenti (Documents)
- File upload area (drag-and-drop or button)
- List of attached documents with: name, size, uploader, date, download button, delete
- Upload goes to `tenant-documents` storage bucket under `opportunities/{id}/` prefix

### Tab 3: Diskusija (Discussion/Chat)
- Chat-style thread for internal team communication
- Each message shows: avatar, user name, timestamp, content
- Support @mention of team members (autocomplete from `tenant_members` joined with `profiles`)
- Text input at bottom with send button
- Threaded replies (optional, via parent_id)

### Tab 4: Aktivnost (Activity Log)
- Chronological feed of all actions on this opportunity
- Auto-logged events: stage changes, document uploads, comments, meetings added, quotes created, tags modified
- Each entry: icon + description + user + timestamp
- Activity gets logged automatically via the mutation handlers (no separate triggers needed -- we log from the frontend on each action)

### Tags System
- Show tags as colored badges near the title
- "Add tag" popover with text input + color picker
- Click tag to remove
- Tags shown on Kanban cards too (in Opportunities.tsx)

### Followers / Team Tagging
- "Followers" section showing team members watching this deal
- "Add follower" dropdown listing tenant members
- Followers get highlighted in the discussion @mention autocomplete

## Files to Create/Modify

1. **New migration** -- Create 5 tables + RLS policies
2. **`src/pages/tenant/OpportunityDetail.tsx`** -- Major rewrite with Tabs layout, 4 tabs
3. **`src/pages/tenant/Opportunities.tsx`** -- Show tags on Kanban cards
4. **`src/i18n/translations.ts`** -- New keys: documents, discussion, activity, addTag, addFollower, uploadDocument, writeComment, tagColor, followers, activityLog, stageChanged, documentUploaded, commentAdded, etc.

## Implementation Notes

- Documents use Supabase Storage (`tenant-documents` bucket) with path `opportunities/{opp_id}/{filename}`
- Chat uses real-time polling via React Query refetchInterval (no need for Supabase Realtime complexity)
- Activity log entries are created inline in the existing mutations (stage change, quote creation) and new ones (document upload, comment)
- @mentions are stored as `@[uuid]` in comment text and rendered as highlighted names
- Tags are free-text with optional color -- no predefined tag list (users create as needed)
