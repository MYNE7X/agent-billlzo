# 🚀 BILLZO OFFICE MANAGEMENT SYSTEM — MASTER PROMPT
### For Google AI Studio / Gemini / Any AI Code Generator

---

## PROJECT OVERVIEW

Build a **production-ready, premium SaaS Office Management System** called **"Billzo Office Management"**.

**Stack:**
- React 19 + Vite 8
- TypeScript (strict mode)
- Tailwind CSS v4
- Supabase (Auth + PostgreSQL + Storage + Realtime)
- TanStack Router v1 (file-based routing)
- TanStack Query v5
- Shadcn/ui component library (Radix UI primitives)
- Recharts for analytics
- jsPDF + jspdf-autotable for PDF export
- XLSX for Excel export
- Web Push API (for push notifications)
- Sonner (toast notifications)
- React Hook Form + Zod (validation)

---

## BRANDING & IDENTITY

### Logo
Create a unique SVG logo for "Billzo":
- Shape: A stylized **"B"** lettermark inside a rounded square/shield
- The "B" is formed by two overlapping hexagonal or geometric arcs giving it a tech/fintech feel
- Primary color: `#00C896` (emerald teal) on a dark `#0D1117` background
- Add a subtle gradient shimmer on the B shape (left: #00C896, right: #00A3FF)
- The wordmark "Billzo" sits to the right in a bold, modern sans-serif
- Sub-label "OFFICE MANAGEMENT" in small uppercase tracking-widest below
- Use this logo in: sidebar/navbar, login page, PDF exports, notification icons, PWA manifest

### Color Palette
```css
--primary: #00C896;          /* teal/emerald accent */
--primary-dark: #00A3FF;     /* blue gradient end */
--background: #0A0E1A;       /* deep navy */
--surface: #111827;          /* card background */
--surface-2: #1C2333;        /* elevated surface */
--border: rgba(255,255,255,0.08);
--text: #F0F4FF;
--text-muted: #6B7A99;
--danger: #FF4D6D;
--warning: #FFB547;
--success: #00C896;
```

### Typography
- Headings: `Inter` or `Plus Jakarta Sans` — bold, tight tracking
- Body: `Inter` — 14px base
- Mono: `JetBrains Mono` — for IDs, codes, timestamps

### Design Language
- **Dark Glass Theme**: frosted glass cards (`backdrop-filter: blur(20px); background: rgba(17,24,39,0.7); border: 1px solid rgba(255,255,255,0.08)`)
- Animated gradient borders on active cards
- Micro-animations on all interactive elements (scale, fade, slide)
- Skeleton loaders on all data fetches
- Smooth page transitions (fade + slight upward slide: `animate-rise`)
- Responsive: mobile-first, works on 320px → 1920px+

---

## LOADER / LOADING SCREEN

Create a full-screen loader shown during:
1. Initial app load (auth check)
2. Route transitions
3. Heavy data fetches

**Loader design:**
```
- Centered on screen with dark background
- The Billzo "B" logo SVG animates: rotating border glow, pulsing scale (0.95 → 1.05)
- Three dots below the logo pulse in sequence (left → center → right) in primary color
- Fade in on mount, fade out when ready
- Text below: "Loading Billzo..." in muted foreground
```

**Skeleton loaders:**
- All tables: show 5 shimmer rows
- Cards: show shimmer rectangle matching card dimensions
- Profile: circular shimmer + line shimmers

---

## FOOTER

Every page has a sticky footer at the bottom:
```
© 2026 Billzo Office Management. All rights reserved.   |   Made with ♥ by Aziz
```
- Right-aligned "Made with ♥ by Aziz" — the ♥ pulses in primary color on hover
- Links: Privacy Policy · Terms of Service (placeholder pages)
- Very subtle top border in `--border` color
- Font size: 11px, color: `--text-muted`

---

## PUSH NOTIFICATIONS (PWA + Web Push)

### Setup
1. Register a **Service Worker** (`public/sw.js`) that handles:
   - Push event listener: displays native OS notification
   - Notification click: opens the app to `/attendance`
   - Background sync for offline clock-in queue

2. In `src/lib/push.ts`:
   - `subscribeToPush()` — requests notification permission, creates PushSubscription, saves to Supabase `push_subscriptions` table
   - `sendPushToAll(payload)` — called server-side (Edge Function) or via Supabase trigger
   - VAPID keys stored in env vars: `VITE_VAPID_PUBLIC_KEY`

3. **Supabase Edge Function** `notify-checkin`:
   - Triggered when a new `attendance` row is inserted (clock_in is set)
   - Sends push to all `super_admin` and `admin` subscribers:
     ```
     Title: "📍 Agent Checked In"
     Body:  "{agent_name} clocked in at {time} — {department}"
     Icon:  "/icons/logo-192.png"
     Badge: "/icons/badge-72.png"
     Data:  { url: "/attendance" }
     ```
   - Also sends to the agent themselves: "✅ Your attendance has been recorded for today."

4. **In-App Notification Bell** (top navbar):
   - Badge count of unread notifications
   - Dropdown panel showing last 20 notifications with:
     - Agent avatar + name
     - Action description
     - Timestamp (relative: "2 mins ago")
     - Mark as read / Mark all as read
   - Stored in Supabase `notifications` table

5. **PWA Manifest** (`public/manifest.json`):
   ```json
   {
     "name": "Billzo Office Management",
     "short_name": "Billzo",
     "theme_color": "#00C896",
     "background_color": "#0A0E1A",
     "display": "standalone",
     "icons": [72, 96, 128, 144, 152, 192, 384, 512]
   }
   ```

---

## DATABASE SCHEMA (Supabase PostgreSQL)

Run these migrations in order:

### 1. ENUMs
```sql
CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'suspended', 'resigned');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'leave', 'holiday');
CREATE TYPE app_role AS ENUM ('super_admin', 'admin', 'agent');
CREATE TYPE document_category AS ENUM (
  'profile_picture', 'cnic_front', 'cnic_back', 'passport',
  'certificate', 'resume', 'contract', 'other'
);
CREATE TYPE notification_type AS ENUM (
  'checkin', 'checkout', 'new_agent', 'password_reset',
  'document_upload', 'attendance_adjustment', 'system'
);
```

### 2. PROFILES (auto-created on Supabase Auth signup)
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  email           TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  must_change_password BOOLEAN DEFAULT FALSE,
  is_approved     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: users can read/update their own row; staff can read all
```

### 3. USER_ROLES
```sql
CREATE TABLE user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);
```

### 4. DEPARTMENTS
```sql
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO departments (name) VALUES
  ('Sales'), ('Support'), ('Operations'), ('HR'), ('IT'), ('Finance'), ('Marketing');
```

### 5. DESIGNATIONS
```sql
CREATE TABLE designations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO designations (name) VALUES
  ('Agent'), ('Senior Agent'), ('Team Lead'), ('Manager'),
  ('Assistant Manager'), ('Director'), ('Intern'), ('Supervisor');
```

### 6. AGENTS (core table)
```sql
CREATE TABLE agents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- IDs
  employee_id           TEXT NOT NULL UNIQUE,   -- auto: BZ-0001, BZ-0002 ...
  reference_id          TEXT NOT NULL UNIQUE,   -- auto: REF-XXXXXX

  -- Personal
  full_name             TEXT NOT NULL,
  father_name           TEXT,
  date_of_birth         DATE,
  gender                TEXT,                   -- Male / Female / Other
  blood_group           TEXT,                   -- A+, A-, B+, etc.
  marital_status        TEXT,                   -- Single / Married / etc.
  profile_picture_url   TEXT,

  -- CNIC (Pakistani National ID)
  cnic_number           TEXT UNIQUE,            -- 00000-0000000-0
  cnic_front_url        TEXT,
  cnic_back_url         TEXT,
  cnic_expiry           DATE,

  -- Passport
  passport_number       TEXT,
  passport_url          TEXT,
  passport_expiry       DATE,

  -- Contact
  phone_number          TEXT,
  whatsapp_number       TEXT,
  email                 TEXT UNIQUE,
  emergency_contact_name   TEXT,
  emergency_contact_number TEXT,

  -- Address
  home_address          TEXT,
  city                  TEXT,
  province              TEXT,
  country               TEXT DEFAULT 'Pakistan',
  postal_code           TEXT,

  -- Employment
  department_id         UUID REFERENCES departments(id),
  designation_id        UUID REFERENCES designations(id),
  employee_type         TEXT,    -- Full Time / Part Time / Contract / Internship / Probation
  joining_date          DATE,
  probation_end_date    DATE,
  shift_timing          TEXT,    -- Morning / Evening / Night / Flexible
  reporting_manager     TEXT,
  assigned_admin_id     UUID REFERENCES auth.users(id),
  status                agent_status DEFAULT 'active',

  -- Salary & Banking
  salary                NUMERIC(12,2),
  salary_currency       TEXT DEFAULT 'PKR',
  bank_name             TEXT,
  account_title         TEXT,
  account_number        TEXT,
  iban                  TEXT,

  -- Education
  highest_qualification TEXT,
  degree                TEXT,
  institute_name        TEXT,
  graduation_year       INTEGER,

  -- Experience
  previous_company      TEXT,
  previous_experience   TEXT,
  skills                TEXT,
  languages             TEXT,
  certifications        TEXT,

  -- Misc
  notes                 TEXT,

  -- Auth link
  user_id               UUID UNIQUE REFERENCES auth.users(id),

  -- Audit
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate employee_id and reference_id via DB function + trigger
CREATE OR REPLACE FUNCTION generate_agent_ids()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) + 1
    INTO next_num FROM agents;
  NEW.employee_id := 'BZ-' || LPAD(next_num::TEXT, 4, '0');
  NEW.reference_id := 'REF-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_ids
  BEFORE INSERT ON agents
  FOR EACH ROW EXECUTE FUNCTION generate_agent_ids();
```

### 7. AGENT_DOCUMENTS
```sql
CREATE TABLE agent_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  category      document_category DEFAULT 'other',
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_path     TEXT,
  file_size     BIGINT,
  file_type     TEXT,
  uploaded_by   UUID REFERENCES auth.users(id),
  uploaded_date DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 8. ATTENDANCE
```sql
CREATE TABLE attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in    TIMESTAMPTZ,
  clock_out   TIMESTAMPTZ,
  total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0, 2)
      ELSE NULL
    END
  ) STORED,
  status      attendance_status,
  notes       TEXT,            -- admin adjustment notes
  is_manual   BOOLEAN DEFAULT FALSE,  -- TRUE if admin manually added
  adjusted_by UUID REFERENCES auth.users(id),  -- who adjusted it
  adjusted_at TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agent_id, date)
);
-- Index for fast date-range queries
CREATE INDEX idx_attendance_date ON attendance(date DESC);
CREATE INDEX idx_attendance_agent ON attendance(agent_id);
```

### 9. PUSH_SUBSCRIPTIONS
```sql
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
```

### 10. NOTIFICATIONS
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type DEFAULT 'system',
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  entity_type TEXT,           -- 'agent', 'attendance', etc.
  entity_id   UUID,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
```

### 11. ACTIVITY_LOGS
```sql
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,    -- 'created_agent', 'adjusted_attendance', etc.
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 12. Row-Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_staff(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = uid AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Agents: staff can do anything; agents can only read their own
CREATE POLICY "staff_all_agents" ON agents
  FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "agent_own" ON agents
  FOR SELECT USING (user_id = auth.uid());

-- Attendance: staff full access; agents see only own
CREATE POLICY "staff_all_attendance" ON attendance
  FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "agent_own_attendance" ON attendance
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- Notifications: users see only their own
CREATE POLICY "own_notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- Push subscriptions: users manage only their own
CREATE POLICY "own_push_subs" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());
```

### 13. Supabase Storage Buckets
```
agents-docs    (private) — CNIC, passport, certificates, other documents
avatars        (public)  — profile pictures
```

---

## USER ROLES & PERMISSIONS

### Super Admin
- Full system access
- Manage all admins and agents
- Assign/remove roles
- View and export all data (PDF, Excel)
- Delete any record
- System settings
- View activity logs
- Force password change for any user
- Send password reset email
- Approve/reject pending signups
- Adjust attendance for any agent on any date

### Admin
- Manage agents assigned to them
- Add/edit agent profiles
- Manage attendance (clock-in, clock-out, adjustment)
- Add manual attendance records
- View reports for their agents
- Cannot delete agents (super admin only)
- Cannot manage other admins

### Agent
- View own profile (read-only for employment/salary fields)
- Clock in and clock out (once per day)
- View own attendance history (90 days)
- Upload own documents
- Update allowed fields: phone, whatsapp, home address, emergency contact
- Must change temporary password on first login

---

## APPLICATION PAGES & FEATURES

### 1. Authentication (`/`)
**Login Page:**
- Split-screen layout: left = Billzo hero section, right = auth form
- Features highlight cards on left: Role-based access, Document vault, Clock in/out
- Tab toggle: Sign In / Create Account
- Email + password fields with show/hide password toggle
- Loading state on submit button
- Error handling with toast notifications
- "The first account created becomes the Super Admin" note

**Force Change Password Overlay:**
- Full-screen modal overlay when `must_change_password = true`
- Current password field (optional)
- New password + confirm password fields
- Password strength meter (weak/medium/strong)
- Auto-clears flag in Supabase after successful change

**Pending Approval Screen:**
- Shown when `is_approved = false`
- Animated waiting illustration
- "Your account is pending approval from a Super Admin."
- Contact info / logout button

---

### 2. Dashboard (`/dashboard`)
Premium analytics overview:

**Stats Cards (animated, with trend arrows):**
- Total Agents (+ new this month)
- Present Today / Absent Today
- Late Arrivals Today
- Total Hours Logged (today)
- Pending Approvals

**Today's Attendance Summary:**
- Donut chart (Present / Absent / Late / Leave / Holiday)
- Mini attendance feed: last 10 clock-ins with agent avatar + time

**Charts:**
- Weekly Attendance Trend (line chart, 7 days)
- Department-wise Headcount (bar chart)
- Monthly Hours Worked (area chart)

**Quick Actions (staff only):**
- Add New Agent button
- Add Attendance Record button
- Export Today's Report button

**Recent Activity Feed:**
- Last 15 activity_logs entries
- Agent avatar + action description + timestamp

---

### 3. Agents (`/agents`)
**Agent List Page:**
- Search bar (search by name, employee ID, CNIC, email)
- Filters: Department, Status (active/inactive/etc.), Employee Type
- Data table with columns:
  - Profile Picture (avatar)
  - Employee ID + Name
  - Department / Designation
  - Phone
  - Status badge (colored)
  - Joining Date
  - Actions: View, Edit, Delete (super admin only)
- Export to PDF / Excel buttons
- "Add Agent" button (staff only)
- Pagination (20 per page)

**New Agent (`/agents/new`):**
- Multi-step form with progress indicator:
  - Step 1: Personal Info
  - Step 2: Contact Info
  - Step 3: Employment Info
  - Step 4: Salary & Banking
  - Step 5: Education & Experience
  - Step 6: Documents Upload
- Auto-generate Employee ID (BZ-XXXX) and Reference ID (REF-XXXXXX) on save
- Drag & drop file upload for documents
- Image preview for photos

**Agent Detail (`/agents/:id`):**
Tabs:
1. **Profile** — Full editable form (all sections above)
2. **Documents** — Upload / view / download / delete documents. Image preview modal. Secure signed URLs.
3. **Attendance** — Agent's 90-day attendance history (filterable by month). Summary stats: total days, present, absent, late, hours.
4. **Link Account** (staff only) — Link existing Supabase user to this agent
5. **Login / Password** (super admin only) — Create login account with temporary password, or reset existing account password

---

### 4. Attendance (`/attendance`)

**Header:**
- Date picker (defaults to today)
- "Add Record" button (staff only) — opens dialog to manually add attendance for any agent on any date
- Record count display

**My Clock-in Card** (for linked agents):
- Shows agent name, today's clock-in time, clock-out time, hours
- Clock In / Clock Out buttons with disabled states
- Sends push notification to all admins on clock-in

**Attendance Table:**
Columns:
- Agent (avatar + name + employee ID)
- Department
- Clock In time
- Clock Out time
- Total Hours
- Status badge (Present/Absent/Late/Half Day/Leave/Holiday)
- Notes (admin note if adjusted)
- Adjust button (staff only) — opens edit dialog

**Edit Attendance Dialog** (staff only):
- Clock In time picker
- Clock Out time picker
- Status dropdown
- Admin note textarea
- Auto-calculates hours on save
- Logs adjustment in activity_logs

**Add Record Dialog** (staff only):
- Agent selector (searchable dropdown)
- Date picker
- Clock In / Clock Out time pickers
- Status selector
- Note field
- Marks `is_manual = true`, stores `created_by`

---

### 5. Admins & Roles (`/admins`) — Super Admin only
**Stats:**
- Super Admin count, Admin count, Agent count, Pending count

**Tabs:**
1. **Staff** — All users with admin/super_admin roles. Cards with avatar, email, roles, actions.
2. **All Users** — All registered users. Search + role filter.
3. **Pending Approvals** — Users waiting for approval. Approve / Reject buttons.
4. **Activity Log** — Timeline of all admin actions.

**User Actions (per user):**
- Assign Role (admin / agent)
- Remove Role
- Force Password Change on next login
- Send Password Reset Email
- View Linked Agent
- Delete Account (super admin only)
- Protected accounts cannot be modified (PROTECTED_EMAILS list)

---

### 6. My Profile (`/my-profile`) — Linked agents only
- View own full profile
- Edit allowed fields (phone, whatsapp, address, emergency contact)
- Upload/view own documents
- 90-day attendance history with summary

---

### 7. Pending Approvals (`/pending-approvals`) — Staff only
- List of unapproved users
- Approve or Reject each one

---

### 8. Settings (`/settings`) — Super Admin only
- Manage Departments (add/edit/delete)
- Manage Designations (add/edit/delete)
- System info
- Notification preferences (which events trigger push to whom)

---

## NAVIGATION (AppShell)

**Sidebar (desktop) / Bottom Tab Bar (mobile):**
```
🏠  Dashboard
👥  Agents
📋  Attendance
⏳  Pending Approvals  (staff only, badge with count)
🛡️  Admins & Roles    (super admin only)
👤  My Profile         (linked agents)
⚙️  Settings           (super admin only)
```

**Top Navbar:**
- Billzo logo (left)
- Notification bell with unread badge (right)
- User avatar + name + role badge (right)
- Sign out button

---

## KEY TECHNICAL REQUIREMENTS

### Supabase Realtime
Subscribe to `attendance` table inserts:
```typescript
supabase.channel('attendance-changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' },
    (payload) => {
      // Update dashboard stats in real-time
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      // Show in-app notification
      showNotification(`${agentName} just clocked in!`);
    }
  )
  .subscribe();
```

### Push Notification Service Worker (`public/sw.js`)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/logo-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
```

### Auto-logout
If session expires while app is open, redirect to `/` with "Session expired" toast.

### Offline Support
- Cache critical assets in service worker
- Show "You are offline" banner
- Queue clock-in/out when offline, sync when reconnected

### Export Functions
```typescript
// PDF: agent list / attendance report
exportAttendancePDF(rows, date, filters);
exportAgentListPDF(agents);

// Excel: attendance report with all columns
exportAttendanceExcel(rows, dateRange);
exportAgentListExcel(agents);
```

### Environment Variables
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=   # Web Push VAPID public key
```

---

## ANIMATIONS & UX DETAILS

```css
/* Page entry animation */
@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-rise { animation: rise 0.3s ease-out forwards; }

/* Glass card */
.glass {
  background: rgba(17, 24, 39, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Shimmer skeleton */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #1C2333 25%, #253045 50%, #1C2333 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

**Interactive details:**
- All buttons: scale(0.97) on active
- Cards: subtle border glow on hover
- Table rows: bg highlight on hover
- Status badges: colored dots + text
- Toasts: bottom-right, 4s auto-dismiss, action buttons on critical ones

---

## COMPLETE FILE STRUCTURE

```
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx                         (login/signup)
│   └── _authenticated/
│       ├── route.tsx                     (auth guard + layout)
│       ├── dashboard.tsx
│       ├── agents/
│       │   ├── index.tsx
│       │   ├── new.tsx
│       │   └── $agentId.tsx
│       ├── attendance/
│       │   └── index.tsx
│       ├── admins.tsx
│       ├── my-profile.tsx
│       ├── pending-approvals.tsx
│       └── settings.tsx
├── components/
│   ├── auth/
│   │   ├── ForceChangePassword.tsx
│   │   └── PendingApproval.tsx
│   ├── agents/
│   │   ├── AgentForm.tsx                 (multi-step)
│   │   ├── DocumentManager.tsx
│   │   ├── LinkAccountPanel.tsx
│   │   └── SetPasswordPanel.tsx
│   ├── attendance/
│   │   └── AttendanceAdjustDialog.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopNav.tsx
│   ├── notifications/
│   │   ├── NotificationBell.tsx
│   │   └── NotificationPanel.tsx
│   ├── billzo/
│   │   ├── BillzoLogo.tsx               (SVG logo component)
│   │   ├── Loader.tsx                   (full-screen animated loader)
│   │   ├── StatusBadge.tsx
│   │   ├── StatCard.tsx
│   │   ├── SecureImage.tsx
│   │   ├── ImagePreviewModal.tsx
│   │   └── FileDropzone.tsx
│   └── ui/                              (shadcn components)
├── hooks/
│   ├── useAuth.tsx
│   ├── usePushNotifications.ts
│   ├── use-mobile.tsx
│   └── useRealtimeAttendance.ts
├── lib/
│   ├── queries.ts
│   ├── admin-queries.ts
│   ├── push.ts                          (Web Push helpers)
│   ├── export.ts                        (PDF/Excel export)
│   ├── storage.ts                       (Supabase Storage)
│   ├── billzo.ts                        (constants/helpers)
│   └── utils.ts
└── integrations/
    └── supabase/
        ├── client.ts
        └── types.ts

public/
├── sw.js                                (service worker)
├── manifest.json                        (PWA manifest)
└── icons/
    ├── logo-192.png
    ├── logo-512.png
    └── badge-72.png
```

---

## ADDITIONAL REQUIREMENTS

1. **First-run experience**: First account registered automatically gets `super_admin` role and `is_approved = true` via DB trigger.

2. **Account creation by admin**: Admin can create an agent's login account with a temporary password directly from the agent detail page. Agent is flagged `must_change_password = true` and sees the ForceChangePassword overlay on first login.

3. **Password reset flow**:
   - Option A: Admin marks account for forced change (agent logs in with old password, immediately must set new one)
   - Option B: Admin sends Supabase reset email (one-click or combined with Option A)

4. **Attendance auto-status**: When clocking in, auto-set status based on time:
   - Before 09:15 → "present"
   - 09:15–10:00 → "late"
   - After 10:00 → "late" (admin reviews)

5. **Mobile-first clock-in**: On mobile, the attendance page shows a large prominent clock-in/clock-out button with current time display.

6. **Secure image loading**: Profile pictures and documents use signed Supabase Storage URLs (expire 1h), fetched and cached client-side.

7. **CNIC format validation**: Pakistani CNIC format `00000-0000000-0` enforced with regex + React Hook Form.

8. **Phone format**: Pakistani format `+92 300 0000000` preferred.

9. **Currency**: PKR (Pakistani Rupee) — format as `₨ 1,23,000`

10. **Timezone**: All timestamps display in PKT (UTC+5), but store as UTC in Supabase.

---

## "MADE BY AZIZ" FOOTER

Every page footer (inside the `AppShell` layout wrapper) includes:

```tsx
<footer className="border-t border-border/30 px-6 py-3 text-[11px] text-muted-foreground flex items-center justify-between">
  <span>© 2026 Billzo Office Management. All rights reserved.</span>
  <span className="flex items-center gap-1">
    Made with{" "}
    <span className="animate-pulse text-primary">♥</span>
    {" "}by{" "}
    <span className="font-semibold text-foreground">Aziz</span>
  </span>
</footer>
```

---

*End of Master Prompt — Build the complete, production-ready Billzo Office Management System as described above.*
