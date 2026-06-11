# Meat Tycoon 🥩💸

**Meat Tycoon** is an immersive, production-oriented, single-player incremental cooking economy game. Built on a server-authoritative architecture, it combines the thrill of high-stakes random-weight item rolls (gacha-style RNG weight system) with complex cooking timing, seasoning compatibility, and massive, exponential multiplier scaling.

The game is designed with a premium, clean light dashboard interface leveraging Next.js, Ant Design, and Supabase.

---

## 🎮 Game Concept & Loop

The core progression loop follows the cycle:
1. **Buy Raw Meat:** Pay a fixed purchase price to acquire a cut of meat.
2. **Roll Spawned Weight:** The meat rolls a random weight (in kg) upon purchase. There is no hard cap—an incredibly lucky roll (decaying power-law distribution) can result in a jackpot.
3. **Cook in Real Time:** Cook raw meat using various kitchen equipment (ovens, grills, smokers) to target a specific doneness (Cooked, Well Cooked, or Perfectly Cooked).
4. **Stack Multipliers:** Apply durable, multi-use seasonings (like Salt, Garlic Powder, or Barbecue Rubs) that synergize with specific cuts and methods.
5. **Sell and Reinvest:** Sell the finished meat for a massive payout scaled by weight, equipment multipliers, doneness, and seasoning. Reinvest profits into buying higher-tier meats or upgrading to restaurant-grade and industrial kitchen setups.

---

## 🚀 Key Features

* **Real-Time Simulation:** Cook times and meat spoilage progress in real time (cooked meat spoils after 3 real days; raw meat never spoils).
* **Durable Seasoning System:** Buy and apply seasonings with distinct usage durability and multipliers.
* **Progressive Equipment:** Scale from a humble free Countertop Oven (1.1x) to commercial grills, smoking rigs, and industrial-scale production lines (up to billions in multiplier scaling!).
* **Upgradable Shops:** Level up shop refresh speeds and stock luck tiers to unlock rare cuts and luxury meats (such as dry-aged steak, Jamón Ibérico, or Kobe A5).
* **Cross-Device Sync:** Play as a guest or sign in securely with Google or email/password to persist your progress via Supabase.

---

## 🛠️ Technology Stack

* **Frontend:** Next.js (React 19, App Router)
* **Styling & UI:** Ant Design (AntD v5), Vanilla CSS, Iconify icons
* **Database & Auth:** Supabase (Postgres database, Supabase Auth, Row Level Security, RPC functions)
* **Testing:** Node.js native test runner (`tests/` directory)

---

## 📥 Getting Started & Local Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v20+ recommended)
* A [Supabase](https://supabase.com/) project

### Setup Instructions

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/prezvious/meat-tycoon.git
   cd meat-tycoon
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase project credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

4. **Initialize the Database:**
   Apply the SQL migration files located in the `supabase/migrations/` directory in filename order (e.g., using the Supabase Dashboard SQL Editor or Supabase CLI).

5. **Seed the Catalog:**
   Populate the database tables from the Markdown source documentation (parsed automatically by the catalog parser):
   ```bash
   npm run seed:catalog
   ```

6. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to play!

---

## 🧪 Verification & Linting

Run the complete test, validation, type checking, and production build checks:
```bash
npm run verify
```

Individual checks can also be run:
* **Catalog Validation:** `npm run catalog:verify`
* **Unit Tests:** `npm run test`
* **Linter:** `npm run lint`
* **Type Checker:** `npm run typecheck`
* **Production Build:** `npm run build`
