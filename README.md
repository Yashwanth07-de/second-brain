# 🧠 Second Brain

A personal life organiser — notes, finance, health, bills, subscriptions, and credit cards.
All data stored locally in your browser. No API key, no server, no login.

---

## 📁 Project structure

```
second-brain/
│
├── index.html              ← Main HTML shell (all sections live here as <section> divs)
│
├── css/
│   ├── main.css            ← Design system: variables, colors, typography, cursor, animations
│   ├── layout.css          ← Sidebar, topbar, content area, section grid layouts
│   └── components.css      ← All reusable UI: cards, buttons, inputs, modal, badges, glance
│
├── js/
│   ├── storage.js          ← localStorage CRUD helpers (Storage object + utility functions)
│   ├── cursor.js           ← Custom cursor: dot + lagging ring animation
│   ├── glance.js           ← Smart Daily Glance (keyword scan — no API key needed)
│   ├── notes.js            ← Notes section: CRUD, tag filtering, search, render
│   ├── health.js           ← Health section: appointments + medications
│   ├── finance.js          ← Finance section: income/expense tracking, categories
│   ├── modules.js          ← Savings · Bills · Subscriptions · Credit Cards (all in one file)
│   └── app.js              ← Main controller: navigation, modal, dashboard, init (load LAST)
│
└── README.md               ← This file
```

---

## 🚀 How to run

1. Open the `second-brain/` folder in VS Code
2. Install the **Live Server** extension (if not already)
3. Right-click `index.html` → **Open with Live Server**
4. That's it — opens in your browser, all data persists in localStorage

OR simply double-click `index.html` to open directly in any browser.

---

## ✏️ How to edit each section

| Want to change...          | Go to file              |
|----------------------------|-------------------------|
| Colors, fonts, theme vars  | `css/main.css`          |
| Sidebar, topbar, layout    | `css/layout.css`        |
| Cards, buttons, modal      | `css/components.css`    |
| Notes logic + render       | `js/notes.js`           |
| Health logic + render      | `js/health.js`          |
| Finance logic + render     | `js/finance.js`         |
| Savings goals              | `js/modules.js` → Savings section |
| Bills tracker              | `js/modules.js` → Bills section   |
| Subscriptions              | `js/modules.js` → Subscriptions   |
| Credit cards               | `js/modules.js` → CreditCards     |
| Daily Glance keywords      | `js/glance.js`          |
| Navigation, modal, init    | `js/app.js`             |
| HTML structure / sections  | `index.html`            |

---

## ⌨️ Keyboard shortcuts

| Shortcut     | Action                |
|--------------|-----------------------|
| `Ctrl/Cmd+K` | Focus search bar      |
| `Ctrl/Cmd+N` | Open "Add new" modal  |
| `Escape`     | Close modal           |

---

## 🎨 Changing the accent color

Open `css/main.css` and change the `--accent` variable:

```css
:root {
  --accent: #c8922a;   /* ← change this to any color you want */
}
```

---

## 📦 Adding a new section

1. Add a `<button class="nav-item" data-section="mysection">` in `index.html`
2. Add a `<section id="section-mysection" class="section">` in `index.html`
3. Add the title to `SECTION_TITLES` in `js/app.js`
4. Create `js/mysection.js` with a `const MySection = (() => { ... })()`
5. Add `<script src="js/mysection.js">` before `app.js` in `index.html`
6. Add `case 'mysection': MySection.render(); break;` in `app.js → renderSection()`

---

## 🗄️ Data storage

All data is stored in `localStorage` under these keys:

| Key                    | Contains              |
|------------------------|-----------------------|
| `sb_notes`             | Notes array           |
| `sb_transactions`      | Finance transactions  |
| `sb_savings`           | Savings goals         |
| `sb_bills`             | Bills                 |
| `sb_subscriptions`     | Subscriptions         |
| `sb_creditcards`       | Credit cards          |
| `sb_appointments`      | Health appointments   |
| `sb_medications`       | Medications           |
| `sb_activity`          | Recent activity log   |

To export your data: open browser DevTools → Application → Local Storage → copy the values.

---

Built with ♥ using vanilla HTML, CSS, and JavaScript. No frameworks, no build tools, no API keys.
