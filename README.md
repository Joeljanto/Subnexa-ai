# SubNexa AI 🚀
> **The Revenue Rescue Platform** — Powered by **SubSage Intelligence**

SubNexa AI is a hackathon prototype for subscription revenue rescue and retention. Built with **React + Vite**, **Tailwind CSS**, **Python Flask**, **SQLite**, and **scikit-learn**, it identifies billing exposure, explains customer risk, simulates recovery campaigns, and tracks recovery actions.

> **Demo data:** Customer, subscription, payment, and invoice records are seeded locally by `backend/seed.py`. This version does not sync with Stripe or another live billing provider, so dashboard amounts are sample data rather than live transactions.

---

## ⚡ The Revenue Rescue Lifecycle

```
Failed Payment / Overdue Balance
         │
         ▼
[ Revenue Rescue Radar ] ──▶ Multi-vector de-duplicated exposure detection ($)
         │
         ▼
[ SubSage Risk Engine ]  ──▶ 7-dimension explainable factor attribution & recommendations
         │
         ▼
[ Recovery Simulator ]   ──▶ What-If modeled campaigns & diminishing return projections
         │
         ▼
[ Recovery Tracking ]    ──▶ Staff outreach workflow, response logging & notes
         │
         ▼
[ Confirmed Collection ] ──▶ Strict cash accounting (only verified funds credited)
         │
         ▼
[ Immutable Audit Trail] ──▶ Chronological ledger entry and real-time Radar sync
```

---

## 🏆 Key Innovations & Modules

### 1. Revenue Rescue Radar
- **Multi-Vector Exposure Calculation**: Computes overdue invoice debt, unrecovered payment failures, and high-risk renewals within 30 days.
- **Strict Anti-Double-Counting**: Overdue invoices are strictly de-duplicated against failed charges to prevent inflating revenue risk.
- **Real-Time Customer Health**: Sortable, filterable radar table with live risk gauges, churn probabilities, and recovery tracking status.

### 2. SubSage Explainable Risk Engine
- **7 Operational Dimensions**:
  1. Failed payment frequency
  2. Late payment history
  3. Payment success ratio
  4. Subscription tenure & ramp-up fragility
  5. Days until renewal
  6. Outstanding arrears ratio
  7. Previous renewals / loyalty tenure
- **Audited Rule-Based + Scikit-Learn Hybrid**: Honest transparency—utilizes audited deterministic scoring when historical data is nascent, with automated scikit-learn ML training activation when sample thresholds are met.
- **Contextual Prescriptive Actions**: Automatically recommends actions (`resolve_payment_failure`, `contact_customer`, `send_payment_reminder`, `review_retention_offer`).

### 3. What-If Revenue Recovery Simulator
- **Diminishing Marginal Returns**: Models combined intervention synergy using independent failure probabilities:
  $$P(\text{Recovery}) = 1 - \prod_{k} (1 - r_k)$$
- **Concession Economics**: Accurately computes discount concession and CS outreach labor costs against gross recovery to determine true **Net Revenue Rescue** and **ROI**.
- **Non-Destructive Sandbox**: Pure read-only in-memory simulation; guaranteed zero alterations to real customer subscriptions, invoices, or payment ledgers.
- **Scenario Persistence**: Save, load, compare, and delete executive simulation scenarios.

### 4. Recovery Tracking & Immutable Audit Trail
- **Strict Confirmed Payment Accounting**: Only confirmed, cleared payments (`is_confirmed_payment == True`) are credited to actual and net recovery figures. Unconfirmed promises remain strictly segregated from recognized revenue.
- **Lifecycle Outreach Tracking**: Staff assign actions, transition statuses (`assigned` → `in_progress` → `completed`/`failed`), and log qualitative customer responses (`promised_to_pay`, `disputed`, `requested_discount`, etc.).
- **Append-Only Audit Ledger**: Every assignment, status transition, outreach note, and payment confirmation logs an immutable audit event recording actor email, timestamp, and metadata.

### 5. Google OAuth 2.0 & Role-Based Access Control
- **Google Identity Services (GIS)**: Seamless Google Sign-In with client-side credential handling and backend token verification.
- **Robust Token Validation**: Validates signature, audience (`GOOGLE_CLIENT_ID`), issuer (`accounts.google.com`), expiration, and verified email status.
- **Account Linking**: Automatically links Google IDs to existing accounts without duplicating profiles or demoting administrative roles.
- **Role Isolation**:
  - `Admin`: Full access, staff creation, model training.
  - `Staff`: Customer monitoring, radar, recovery tracking, simulations.
  - `Customer`: Strict data isolation; access restricted to own profile, invoices, subscriptions, and payments.

---

## 🛠 Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React 19, Vite 8, TypeScript | Single-page app with type safety |
| **Styling** | Tailwind CSS v4 | Responsive light interface with violet accents |
| **Icons & Visuals** | Lucide React, Recharts | Data visualizations, waterfall breakdowns, gauges |
| **Backend** | Python 3.11+, Flask | RESTful API engine with CORS and JWT auth |
| **Database** | SQLite + SQLAlchemy ORM | Relational schema with foreign keys and indexes |
| **AI / ML** | Scikit-learn, NumPy | Risk scoring, feature extraction, ML training |
| **Token Verification** | `google-auth` | Official Google ID token signature verification |

---

## 📁 Repository Structure

```text
subnexa-ai/
├── frontend/                     # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/           # UI cards, badges, charts, auth buttons
│   │   ├── contexts/             # AuthContext (JWT + Google session)
│   │   ├── pages/                # Overview, Radar, Risk, Simulator, Recovery
│   │   ├── types/                # TypeScript interfaces (Google GIS, etc.)
│   │   └── lib/                  # Axios API client with interceptors
│   ├── index.html                # Google Identity Services script
│   └── vite.config.ts            # Vite proxy configuration
├── backend/                      # Flask RESTful API
│   ├── auth/                     # JWT, Google OAuth, decorators, user models
│   ├── customers/                # Customer entities and isolation
│   ├── subscriptions/            # Subscription plans and lifecycle
│   ├── payments/                 # Transactions and failure logs
│   ├── billing/                  # Invoices and past-due tracking
│   ├── intelligence/             # SubSage AI Intelligence
│   │   ├── radar/                # Exposure calculations and customer queries
│   │   ├── risk_engine/          # 7-dimension explainability and ML engine
│   │   └── simulator/            # What-if simulation engine and scenarios
│   ├── recovery/                 # Recovery actions, accounting, audit logs
│   ├── database.py               # SQLAlchemy database session manager
│   ├── seed.py                   # Initial database demo seed data
│   └── app.py                    # Flask application factory
├── tests/                        # 44 passing unit & integration tests
│   ├── test_auth.py              # Email/password authentication & RBAC
│   ├── test_google_auth.py       # Google OAuth token verification & linking
│   ├── test_radar.py             # Exposure de-duplication and filters
│   ├── test_risk_engine.py       # 7-feature explainability and scoring
│   ├── test_simulator.py         # What-if calculations and scenario APIs
│   ├── test_recovery_tracking.py # Confirmed payment accounting & audit trails
│   ├── test_full_revenue_rescue_lifecycle.py # End-to-end 7-step pipeline
│   └── test_health.py            # API health endpoint
├── docs/                         # Guides and architectural documentation
│   └── google_oauth_setup.md     # Google Cloud Console OAuth setup guide
├── requirements.txt              # Backend Python dependencies
├── .env.example                  # Environment template
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

### 2. Backend Setup

```bash
# Clone repository
git clone https://github.com/Joeljanto/Subnexa-ai.git
cd subnexa-ai

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Optional: add your GOOGLE_CLIENT_ID to .env for live Google login

# Seed initial database
python -m backend.seed

# Start Flask backend (runs on port 5000)
python -m backend.app
```

### 3. Frontend Setup

```bash
# In a new terminal:
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server (runs on port 5173)
npm run dev
```

Visit **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔑 Demo Access Credentials

| Email | Password | Role | Description |
|---|---|---|---|
| `admin@subnexa.ai` | `Admin@1234` | **Admin** | Full executive access across all modules |
| `staff@subnexa.ai` | `Staff@1234` | **Staff** | Customer outreach and recovery action tracking |

---

## 🧪 Comprehensive Test Suite (44/44 Passing)

Run the full automated test suite:

```bash
venv\Scripts\python -m pytest tests/ -v
```

```text
============================= test session starts =============================
collected 44 items

tests/test_auth.py ............                                          [ 27%]
tests/test_full_revenue_rescue_lifecycle.py .                            [ 29%]
tests/test_google_auth.py ...........                                    [ 54%]
tests/test_health.py .                                                   [ 56%]
tests/test_radar.py .....                                                [ 68%]
tests/test_recovery_tracking.py ....                                     [ 77%]
tests/test_risk_engine.py .....                                          [ 88%]
tests/test_simulator.py .....                                            [100%]

============================= 44 passed in 9.47s ==============================
```

Frontend production build verification:
```bash
cd frontend && npm run build
# Output: ✓ built in ~800ms with 0 compilation errors
```


---

## 🔐 Google OAuth Configuration

To activate live Google Sign-In:
1. Open [Google Cloud Console](https://console.cloud.google.com/) and create an **OAuth 2.0 Web Client ID**.
2. Add Authorized JavaScript Origin: `http://localhost:5173` and `http://127.0.0.1:5173`.
3. Add Authorized Redirect URI: `http://localhost:5173` and `http://localhost:5000/auth/google/callback`.
4. Copy the Client ID into `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
   And `frontend/.env`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
5. If unconfigured, the application gracefully displays an in-app setup modal with instructions.

---

## 📖 License

MIT License — Developed for the SubNexa AI Revenue Rescue Hackathon.
