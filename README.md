# CertiVerify - Certificate Issuer & Verification System

CertiVerify is a secure, modern, and mobile-first Certificate Issuance and Verification Registry dashboard built with Node.js, Express.js, MongoDB, and premium Vanilla HTML/CSS/JS.

---

## 🌟 Key Features

### 1. Public Registry
- **Verification Search**: Lookup credentials instantly using a cryptographically unique Certificate ID.
- **Camera QR Scanner**: Real-time browser-based QR Code scanning (via `html5-qrcode` library) to auto-verify credentials.
- **Verification History Timeline**: Real-time audit logs of validation checks displayed in an elegant feed.
- **Status Indicator Badges**: Rich glassmorphism notifications for **Valid**, **Revoked**, or **Expired** credentials.

### 2. Admin Command Deck
- **Secure Logins**: JWT token-based authentication and role-based route guards.
- **Overview Dashboard**: Analytics counter cards for total issues, validation hits, and active administrators, accompanied by dynamic datasets (doughnut & bar charts via Chart.js).
- **Branding Customizer**: Adjust color schemes, standard certification descriptors, and upload custom institutional seals/logos or background templates.
- **Bulk CSV Issuance**: Generate hundreds of certificates instantly by dragging and dropping CSV spreadsheets. Includes automated QR code generator attachment.
- **User Settings**: SuperAdmin dashboard settings to add new admins, de-authorize profiles, or adjust roles and access permissions.
- **Audit Logging**: Comprehensive internal activity logs history.

---

## 📂 Project Architecture

```
├── public/                 # Static Frontend Web Client
│   ├── css/
│   │   ├── styles.css      # Core style variables (Light/Dark themes) and landing animations
│   │   └── dashboard.css   # Sidebar cards, forms, tables, modals, badges
│   ├── js/
│   │   ├── app.js          # QR Scanner and verifier search logic
│   │   ├── auth.js         # JWT cookie storage, login handlers, and guards
│   │   └── dashboard.js    # Chart binds, table CRUDs, and drag-drop CSV parsing
│   ├── index.html          # Public landing lookup page
│   ├── verify.html         # Status checks details page
│   ├── login.html          # Admin secure portal login screen
│   ├── dashboard.html      # Administrative management console
│   ├── manifest.json       # PWA configurations
│   └── sw.js               # Service Worker offline asset caching
├── src/                    # Backend MVC Stack
│   ├── controllers/        # Express handlers (Auth, Certificates, Analytics, Users)
│   ├── middleware/         # Security guards, Multer uploads, and error interceptors
│   ├── models/             # Mongoose schemas (User, Certificate, VerificationLog, AuditLog)
│   ├── routes/             # RESTful API route mapping
│   ├── utils/              # PDF creation, QR generation, and E-mail SMTP dispatches
│   └── db.js               # MongoDB connection setup and default account seeder
├── uploads/                # Directory for uploaded seals and templates
├── .env                    # Local environment variables
├── server.js               # Express application entry-point
└── test.js                 # Syntax and module resolution test script
```

---

## ⚙️ Quick Start Installation

### 1. Clone & Install Dependencies
First, ensure you have **Node.js** (v18+) and **MongoDB** installed on your system.
Install project dependencies:
```bash
npm install
```

### 2. Configure Environment Variables
A default `.env` template file is provided at the root:
- Adjust connection strings in `MONGODB_URI` (e.g. your local MongoDB instance or Atlas cluster URL).
- Set standard email SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) to enable email dispatches.

### 3. Run Syntax Validations
Run local compilation tests to verify module paths:
```bash
node test.js
```

### 4. Boot the Server
Run in development mode with hot-reloading:
```bash
npm run dev
```
For production build execution:
```bash
npm start
```
The server will bind on: **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Seeding Credentials

Upon connecting to MongoDB, the system automatically checks and seeds a default SuperAdmin account if it does not already exist:

- **Email**: `santhoshmass252@gmail.com`
- **Password**: `santhoshs2011`

*Note: Once signed in, you can modify passwords or create additional sub-admins from the dashboard settings panel.*
