

## Update WMS AI Section of the Report

### Goal
Rewrite the "WMS AI (Warehouse Management with AI)" section to accurately reflect the current implementation, removing incorrect claims and documenting features that already exist.

---

### Changes Required

#### 1. Current State -- Complete Rewrite
Replace the current description with accurate documentation of:

- **Scenario Management System**: Named scenarios persisted in `wms_slotting_scenarios` with status tracking (analyzing -> completed). Users can browse past scenarios in a sidebar panel and select any to review.

- **Dual-Mode Analysis (AI + Local Heuristic)**:
  - AI mode: Calls `wms-slotting` edge function which computes velocity scores, co-pick affinity from 90-day pick history, sends top 50 SKUs + 100 bins to Gemini-3 via Lovable AI gateway with tool-calling schema
  - Local mode: Built-in greedy algorithm that sorts products by pick velocity and assigns them to bins sorted by accessibility score. No external API call.
  - User toggles between modes via a Switch component in the analysis dialog

- **User-Adjustable Optimization Weights**: Three linked sliders (Travel / Affinity / Space) that auto-balance to 100%. These weights are passed to both AI and local algorithms.

- **Move Plan with Lifecycle**: AI/local recommendations are saved to `wms_slotting_moves` table with statuses: proposed -> approved -> executed. Each move tracks product_id, from_bin_id, to_bin_id, priority, and linked task_id.

- **Task Generation ("Generate Tasks" button)**: Converts proposed moves into `wms_tasks` with type "reslot", creating actionable warehouse tasks with priority ordering. Moves are updated to "approved" status with the linked task ID.

- **Full WMS Module Beyond AI**: Document the complete WMS feature set:
  - Dashboard: KPI cards (bins, utilization, pending/in-progress/completed tasks), task status pie chart, tasks-by-type bar chart, zone overview grid, recent activity feed, quick action buttons
  - Tasks: Full lifecycle (pending -> assigned -> in_progress -> completed/exception), manual task creation, batch operations (start/assign/cancel), worker assignment, priority management (1-5 with inline select), performance KPIs (avg completion time)
  - Receiving: PO linkage, lot/serial tracking, bin assignment
  - Picking: Wave management
  - Cycle Counts: Variance approval workflow
  - Zones & Bins: Zone management with warehouse association, bin detail pages

#### 2. Issues/Risks -- Update
Remove these incorrect items:
- "UI Integration: how does the user apply them? This is unclear -- likely manual" (WRONG: Generate Tasks button exists)

Keep/update these valid items:
- Data Volume: Still valid -- full arrays fetched from DB before slicing for prompt. Add note that local algorithm also fetches all bins/stock/pick history.
- Heuristic Dependence: Rename to "AI Constraint Validation" -- no post-AI capacity checking exists. The local fallback algorithm also doesn't validate bin capacity before assignment.
- Error Handling: Still valid but add detail -- on AI error, toast is shown with error message; empty recommendations show "noResults" text in table.
- Security: Update to note JWT validation + tenant membership check in edge function, plus CORS headers.

Add new issues:
- Batch task generation loops: `generateTasksMutation` issues one INSERT per move sequentially -- should batch.
- Local algorithm doesn't consider bin capacity (`max_units`) when assigning -- it only sorts by accessibility score.
- No scenario comparison view -- users can't easily compare two scenarios side-by-side.

#### 3. Recommendations -- Update
Remove items already implemented:
- "User-adjustable weights" (DONE -- three linked sliders)
- "Add UI steps to review" (DONE -- scenario list + move plan table + Generate Tasks button)
- "Handle empty/partial AI output" (DONE -- shows "noResults" in table)

Keep valid recommendations:
- Restrict prompt size with SQL filtering (still fetches all rows)
- Constraint checking post-AI (still missing)
- Background/scheduled slotting job
- `wms_product_stats` precomputation table
- Affinity graph persistence table
- Simulation integration

Update recommendations:
- "Hybrid algorithm" should note local fallback already exists, but recommend cross-validation (run both, compare results)
- Add: Batch INSERT for move plan and task generation instead of sequential loops
- Add: Bin capacity validation in local algorithm before assignment
- Add: Scenario comparison view (side-by-side KPIs)

#### 4. Flow Diagram -- Update
Update the Mermaid diagram to show the dual-path (AI vs Local) architecture and the full workflow through to task generation:

```text
flowchart TD
    User[User configures weights + warehouse] --> Mode{AI or Local?}
    Mode -->|AI Mode| EdgeFn[Edge Function: wms-slotting]
    Mode -->|Local Mode| LocalAlgo[Greedy Heuristic: velocity x accessibility]

    subgraph EdgeFn[Edge Function]
      PickHistory[90-day Pick History] --> Velocity[Velocity scores]
      PickHistory --> Affinity[Co-pick Affinity]
      BinsData[Bins + Zones] --> Prompt
      Velocity --> Prompt[Build AI Prompt]
      Affinity --> Prompt
      Prompt --> AI[Gemini-3 via AI Gateway]
      AI -->|Tool Call JSON| Parse[Parse Recommendations]
    end

    subgraph LocalAlgo[Local Algorithm]
      FetchData[Fetch bins + stock + picks] --> SortProducts[Sort products by velocity]
      SortProducts --> SortBins[Sort bins by accessibility]
      SortBins --> Assign[Greedy assignment]
    end

    Parse --> SaveScenario[Save to wms_slotting_scenarios]
    Assign --> SaveScenario
    SaveScenario --> MovePlan[wms_slotting_moves - proposed]
    MovePlan -->|User clicks Generate Tasks| Tasks[wms_tasks - type: reslot]
    Tasks --> Execution[Warehouse workers execute]
```

#### 5. Comparison Table -- Update
Add "Local Greedy (current)" row to the approaches table, noting it's already built in. Update "AI-based (LLM)" row to note it's already implemented with Gemini-3. Change "Hybrid" row to note the dual-mode toggle already exists.

#### 6. Testing Section -- Update
- Add: Test scenario creation + move plan persistence
- Add: Test Generate Tasks mutation creates correct wms_tasks records
- Add: Test local algorithm produces valid recommendations with known input
- Keep: Mock AI gateway test, empty pick history test, performance test

#### 7. Data/Schema Section -- Update
- Note that `wms_slotting_scenarios` and `wms_slotting_moves` tables already exist
- Keep recommendation for `wms_product_stats` precomputation
- Keep recommendation for persisted affinity graph
- Add: Consider adding `estimated_improvement` columns directly to scenarios (currently stored as JSON)

---

### Technical Details

**File to modify**: The uploaded `deep-research-report.md` -- rewrite the "WMS AI (Warehouse Management with AI)" section entirely.

No code changes needed -- documentation only.

