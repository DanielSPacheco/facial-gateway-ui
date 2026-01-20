# 📦 Facial Gateway – Intelbras

A **facial access control platform** built around a **custom gateway architecture**, integrating **Intelbras facial devices** with modern applications through **REST APIs** and a **web-based management interface**.

This project is designed as a **SaaS / IoT foundation**, enabling centralized management of users, devices, events, and actions such as **remote door opening**.

---

## 🧠 Architecture Overview

[ Web UI (Next.js) ]
↓
[ API Gateway (Node.js) ]
↓
[ Intelbras Facial Devices ]


- **Frontend**: Admin panel and resident portal  
- **Backend**: Gateway responsible for device communication  
- **Agent**: Local network communication with facial devices  
- **Extensible**: Designed to support additional manufacturers in the future  

---

## 📁 Repositories

### 🔧 Backend (Gateway)

- **Repository:** `facial-gateway-intelbras`
- **Stack:** Node.js · REST API · Intelbras Integration (ISAPI / RPC)

**Responsibilities:**
- Direct integration with Intelbras facial devices  
- Remote door opening  
- User and card management  
- REST API exposure for external systems  
- Extensible architecture for multi-vendor support  

---

### 🎨 Frontend (UI)

- **Repository:** `facial-gateway-ui`
- **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui

**Responsibilities:**
- Administrative dashboard  
- Resident portal  
- Device, user, and log management  
- Real-time actions (e.g., open door)  

---

## 🔐 Core Features

### Backend
- 🔌 Direct integration with Intelbras devices  
- 🚪 Remote door control  
- 👤 User and card management  
- 📡 REST API communication  
- 🧩 Multi-vendor-ready architecture  

### Frontend
- 🧑‍💼 Admin area  
- 🏠 Resident area  
- 📊 Dashboard  
- 🖥️ Device management  
- 📜 Event logs  
- 🔘 Real-time actions  

---

## ▶️ Running Locally

### Frontend

```bash
npm install
npm run dev

```

Create .env local

``` .env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_GATEWAY_URL=http://127.0.0.1:4000

```

src/app
├── (auth)        # Authentication (login)
├── (admin)       # Admin dashboard
│   ├── devices
│   ├── users
│   ├── logs
│   └── units
├── (resident)    # Resident portal
├── api           # Internal Next.js API routes
└── components    # UI components and app shell

## 🚧 Project Status

🟡 Actively under development

Planned next steps:

- Full end-to-end flow (UI → API → Device)
- Authentication (JWT / middleware)
- Frontend deployment (Vercel)
- Audit logs and monitoring
- Webhooks
- Multi-device and multi-tenant support

## 🎯 Project Goal

To build a modern, extensible facial access control platform focused on:

- Residential condominiums
- Enterprises
- IoT and smart buildings
- Future integrations with ERPs and CRMs

## 👨‍💻 Author

Daniel Silveira Pacheco

Node.js · REST APIs · Next.js · IoT · SaaS

🇧🇷 Brazil | 🌍 Open to global opportunities

GitHub: https://github.com/DanielSPacheco
LinkedIn: https://www.linkedin.com/in/danielsilveirap