# HealthVault — Extended Profile & Conditions Checklist
**Version:** 1.0 | **Date:** 2026-05-12 | **Status:** Draft for review

---

## 1. Executive Summary

**Goal:** Extend the user profile page with structured health data fields (date of birth, country of residence, height, weight, smoking status, alcohol consumption, physical activity, health conditions checklist) to enable deeper AI-powered health analysis.

**Components:**
- `user_profile` table: stores date_of_birth, height_cm, weight_kg, country, smoking_status, alcohol_use, physical_activity, additional health context
- `conditions` table: curated master list of 15 health conditions (admin-managed)
- `user_conditions` table: user's selected conditions with diagnosis status
- **Note:** `sex` is user-declared (stored in `users.sex` column), not derived from uploaded documents. User sets/updates it from the profile page.

**Success criteria:**
- [ ] Profile page shows all 3 sections (Personal, Residence, Conditions)
- [ ] User can save/update profile data
- [ ] Conditions list is configurable via admin API
- [ ] Conditions are passed to analyze/coach for richer context

---

## 2. Data Model

### 2.1 New Tables

```sql
-- User extended profile (one row per user)
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    date_of_birth DATE,
    height_cm DECIMAL(5,2),       -- height in centimeters
    weight_kg DECIMAL(5,2),      -- weight in kilograms
    country VARCHAR(100),
    smoking_status VARCHAR(20),     -- 'never', 'former', 'current'
    alcohol_use VARCHAR(20),        -- 'none', 'light', 'moderate', 'heavy'
    physical_activity VARCHAR(20),  -- 'sedentary', 'light', 'moderate', 'active'
    additional_notes TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Master list of health conditions (admin-curated)
CREATE TABLE conditions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- e.g. 'T2D', 'HTN'
    name VARCHAR(255) NOT NULL,        -- e.g. 'Type 2 Diabetes'
    category VARCHAR(100),             -- e.g. 'endocrine', 'cardiovascular'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User's selected conditions
CREATE TABLE user_conditions (
    user_id UUID REFERENCES users(id),
    condition_id INTEGER REFERENCES conditions(id),
    is_diagnosed BOOLEAN DEFAULT FALSE,  -- True = diagnosed, False = family history/suspected
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, condition_id)
);
```

### 2.2 Conditions List — MVP (15 Essential)

| Code | Name | Category |
|------|------|----------|
| T2D | Type 2 Diabetes | endocrine |
| T1D | Type 1 Diabetes | endocrine |
| HTN | Hypertension | cardiovascular |
| HLD | Hyperlipidemia | cardiovascular |
| CAD | Coronary Artery Disease | cardiovascular |
| AFIB | Atrial Fibrillation | cardiovascular |
| CKD | Chronic Kidney Disease | renal |
| NAFLD | Non-Alcoholic Fatty Liver Disease | hepatic |
| COPD | COPD | respiratory |
| ASTHMA | Asthma | respiratory |
| HYPOTHY | Hypothyroidism | endocrine |
| HYPERTHY | Hyperthyroidism | endocrine |
| ANEMIA | Iron Deficiency Anemia | hematologic |
| DEPR | Major Depressive Disorder | mental |
| OSTEOAR | Osteoarthritis | musculoskeletal |

---

## 3. API Design

### 3.1 User Profile

```
GET /api/auth/me
→ returns: { id, email, sex, date_of_birth, height_cm, weight_kg, country, additional_notes, conditions: [...] }
  - date_of_birth, height_cm, weight_kg, country, additional_notes from user_profiles table
  - BMI computed client-side as weight_kg / (height_m)² when both available
  - conditions: array of { code, name, category, is_diagnosed }

PATCH /api/auth/me
Body: { date_of_birth?, country?, height_cm?, weight_kg?, additional_notes?, condition_codes?: string[], is_diagnosed_map?: {code: bool} }
→ updates user_profiles table (height_cm and weight_kg are stored as-is, BMI auto-computed client-side from these values)
→ syncs user_conditions (adds new, removes unchecked)
→ returns: { id, email, sex, date_of_birth, height_cm, weight_kg, country, conditions: [...] }
```

### 3.2 Admin — Conditions CRUD

```
GET /api/admin/conditions
→ returns: [{ id, code, name, category, description, is_active }]

POST /api/admin/conditions
Headers: X-Admin-Key: <ADMIN_API_KEY>
Body: { code, name, category, description? }
→ creates new condition

PUT /api/admin/conditions/{code}
Headers: X-Admin-Key: <ADMIN_API_KEY>
Body: { name?, category?, description?, is_active? }
→ updates condition

DELETE /api/admin/conditions/{code}
Headers: X-Admin-Key: <ADMIN_API_KEY>
→ soft delete (is_active = false)
```

### 3.3 Conditions List for Profile

```
GET /api/conditions
→ returns active conditions for profile checklist
[{ code, name, category }]
```

---

## 4. Frontend Requirements

### 4.1 Profile Page — 3 Sections

**Section 1 — Personal Information**
- Date of birth: date picker (YYYY-MM-DD)
- Country: select dropdown (list of countries, default "Switzerland")
- Height: number input (cm) — optional
- Weight: number input (kg) — optional
- BMI: auto-computed and displayed (weight / height²), shown as color-coded badge:
  - <18.5: underweight (amber)
  - 18.5-24.9: normal (green)
  - 25-29.9: overweight (orange)
  - ≥30: obese (red)

**Section 2 — Health Conditions Checklist**
- Fetch active conditions: `GET /api/conditions`
- Display as scrollable grid/list with checkboxes
- Each item shows: name + category badge
- Checked items save is_diagnosed=True
- Custom "Other" free-text field for conditions not in list

**Section 3 — Additional Notes**
- Textarea: "Any other health information you want to share with your coach"
- (No medical advice disclaimer)

### 4.2 Behavior
- Load profile data on mount
- Auto-save on change (debounced 2s) with "Saving…" indicator
- Show "Saved ✓" confirmation after save

---

## 5. Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 + Tailwind | profile page extension |
| API Server | FastAPI | new endpoints |
| Database | PostgreSQL | 3 new tables |
| Storage | VPS PostgreSQL | same DB as users |
| Deploy | VPS systemd | healthvault-api.service |

---

## 6. Implementation Steps

1. Create `user_profiles`, `conditions`, `user_conditions` tables in PostgreSQL
2. Seed `conditions` table with 15 MVP conditions (via raw SQL)
3. Add `GET /api/conditions` endpoint (public, no auth needed)
4. Add `GET /api/admin/conditions` + CRUD (protected by X-Admin-Key header)
5. Extend `GET /api/auth/me` → include profile + conditions
6. Extend `PATCH /api/auth/me` → handle profile updates + condition sync
7. Update frontend profile page with 3 sections
8. Pass conditions in analyze/coach context
9. Test full flow: save profile → analyze → coach

---

## 7. Acceptance Criteria

- [ ] User can set date of birth, country, height, weight and select conditions from checklist
- [ ] BMI is computed client-side and displayed as color-coded badge
- [ ] Profile data persists and reloads correctly
- [ ] Admin can add/update conditions via `POST /api/admin/conditions` (protected)
- [ ] 15 seed conditions are present on fresh DB
- [ ] Build passes with zero errors
- [ ] Analyze endpoint receives conditions in AI context