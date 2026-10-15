# Instructions for Claude / AI Assistant (`claude.md`)

## 1. Project Context

**Project Name:** IT Asset and Custody Management System (IT Demirbaş ve Zimmet Yönetim Sistemi)
**Objective:** A full-stack system to manage corporate IT hardware (laptops, servers, monitors), track asset status, auto-generate QR codes, assign custody to personnel, and maintain full audit logs.

## 2. Tech Stack Requirements

- **Backend:** Node.js (TypeScript) + Express.js
- **Database:** PostgreSQL (v15+) using **Raw SQL only (`pg` library)**. Strictly NO ORMs (No Prisma, TypeORM, etc.).
- **Web Frontend:** React.js (TypeScript + Vite) + Tailwind CSS + shadcn/ui.
- **Mobile App (Bonus):** Flutter (Dart) with camera QR scanning (`mobile_scanner`).
- **Auth & Authorization:** JWT (JSON Web Tokens) with Role-Based Access Control (`Admin`, `Staff`).
- **DevOps:** Docker & Docker Compose.

---

## 3. Functional Requirements Checklist

### Web & Backend (Mandatory)

- **Auth & UI/UX:** JWT Login/Logout, responsive mobile-friendly UI, pagination, direct search, filtering by status/department, and instant Toast/Snackbar notifications.
- **User & Role Management:** Roles (`Admin` vs `Staff`). Admin interface for full User CRUD and password resets.
- **Dashboard:** Metrics for total assets, faulty assets, and in-stock assets.
- **Inventory Management:** CRUD for assets (Brand, Model, Serial No, Purchase Date) with automatic unique QR Code generation upon creation.
- **Custody Management:** Assign assets to employees, return assets to stock, track relational custody history, and generate system audit logs.

### Mobile App (Bonus)

- **Auth & Profile:** Secure login and a personal profile screen displaying currently assigned custody assets.
- **QR Scanner:** Camera-driven QR scanner to fetch real-time asset details (warranty, purchase date, current holder).
- **Field Operations:** Quick field actions: "Assign Asset", "Receive Asset", and "Report Fault".

---

## 4. Engineering Rules & Best Practices

1. **Raw SQL Security:** All database operations MUST use parameterized SQL queries (`pool.query`) to prevent SQL Injection.
2. **Database Transactions:** Use explicit PostgreSQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) for operations that modify multiple tables (e.g., assigning/returning custody).
3. **Standard API Response Format:**
   ```json
   {
     "success": true,
     "message": "Action completed successfully",
     "data": {},
     "error": null
   }
   Frontend Architecture:
   ```

Use Tailwind CSS for responsive layouts.

Use React Query (@tanstack/react-query) for API data fetching, caching, and state updates.

Mobile Architecture: Securely store JWT tokens using flutter_secure_storage.

5. Delivery & Setup Standards
   Docker Compose: A single docker-compose.yml to launch PostgreSQL, Backend, and Web Frontend simultaneously.

Configuration: Include a .env.example file detailing required environment variables.

Documentation: A comprehensive README.md with UI screenshots, environment setup, and execution commands.
