

## Plan: Time-Aware AI Briefing Widget + Personal Tasks & Reminders Widgets

### 3 New Widgets

| Widget | Description |
|--------|-------------|
| **AI Briefing** | Time-aware: Morning (before 12), Midday (12–17), End of Day (after 17). Different greeting, icon, and data focus per period. |
| **Personal Tasks & Reminders** | Todo list with optional due date/time reminders, linkable to any entity (invoice, partner, etc.). Per-user, per-tenant. |
| **Daily Tasks** | Personal daily checklist — auto-resets or filters by today. Lightweight, no linking. |

---

### Step 1 — Database Migration

**Table `user_tasks`**:
- `id`, `user_id`, `tenant_id`, `title`, `description`, `is_completed`, `due_date`, `due_time`, `reminder_at` (timestamptz), `priority` (low/medium/high), `linked_entity_type` (nullable — invoice, partner, employee, product, etc.), `linked_entity_id` (uuid nullable), `created_at`, `updated_at`
- RLS: users manage own tasks only

**Table `user_daily_tasks`**:
- `id`, `user_id`, `tenant_id`, `title`, `task_date` (date, default today), `is_completed`, `sort_order`, `created_at`
- RLS: users manage own tasks only

### Step 2 — Update Edge Function `ai-daily-digest`

- Accept optional `time_of_day` param (or auto-detect from server time)
- Change greeting: "Dobro jutro" / "Dnevni pregled" / "Završni pregled dana"
- Change icon: Sun → CloudSun → Moon
- Morning: yesterday's summary + today's priorities
- Midday: today's progress so far
- End of Day: today's wrap-up + pending items for tomorrow

### Step 3 — AI Briefing Widget Component

- Refactor `AiMorningBriefing.tsx` → `AiBriefingWidget.tsx`
- Auto-detect time period from `new Date().getHours()`
- Pass `time_of_day` to edge function
- Dynamic icon/title/gradient per period

### Step 4 — Personal Tasks Widget Component

- `PersonalTasksWidget.tsx` — CRUD inline list
- Add task with title, optional due date, priority, optional entity link
- Mark complete, delete
- Sort by due date, then priority
- Reminder indicator (bell icon) when `reminder_at` is set

### Step 5 — Daily Tasks Widget Component

- `DailyTasksWidget.tsx` — simple checklist filtered to today
- Add task inline, toggle complete, reorder
- Progress bar showing X/Y completed

### Step 6 — Register in Widget System

- Add 3 entries to `widgetRegistry.ts`: `ai_briefing`, `personal_tasks`, `daily_tasks` (all `requiredModule: "dashboard"`)
- Update `WidgetRenderer.tsx` to render the new components
- Update `seed_default_dashboard` to include `ai_briefing` for all roles
- Add translations (SR/EN)

### Technical Details

- Time detection uses `new Date().getHours()` on client to determine period, passed to edge function
- Tasks use optimistic TanStack Query updates for snappy UX
- Entity linking stores type+id; widget shows a small chip with link to entity page
- Daily tasks auto-filter by `task_date = CURRENT_DATE`

