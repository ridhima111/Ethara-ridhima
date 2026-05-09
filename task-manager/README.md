# ⚡ TaskFlow — Team Task Manager

A full-stack team task management application with role-based access control, project management, and real-time task tracking.

## 🔗 Links
- **Live URL**: `<your-railway-url>`
- **GitHub Repo**: `<your-repo-url>`

---

## 🚀 Features

### Authentication
- Signup / Login with JWT tokens (7-day expiry)
- Role-based access: **Admin** and **Member**
- Secure password hashing with bcryptjs

### Project Management
- Create, edit, archive, and delete projects
- Add/remove team members with project-level roles (Admin/Member)
- Project status tracking (Active, Completed, Archived)
- Progress visualization

### Task Management
- Create tasks with title, description, priority, due date, assignee
- 4 status columns: **Todo → In Progress → Review → Done**
- **Kanban board** and **List view**
- Filter by status, priority, and search
- Task comments
- Overdue detection
- Priority levels: Low, Medium, High, Urgent

### Dashboard
- Stats overview (active tasks, completed, overdue, projects)
- My active tasks (or urgent tasks for admins)
- Overdue tasks alert
- Per-project progress bars
- Activity-aware UI

### Role-Based Access Control
| Action | Member | Project Admin | Global Admin |
|--------|--------|---------------|--------------|
| View projects they belong to | ✅ | ✅ | ✅ |
| Create projects | ❌ | ❌ | ✅ |
| Add/remove members | ❌ | ✅ | ✅ |
| Create tasks | ✅ | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ | ✅ |
| Edit all tasks | ❌ | ✅ | ✅ |
| Delete tasks | ❌ | ✅ | ✅ |
| Delete projects | ❌ | ✅ | ✅ |
| View all data | ❌ | ❌ | ✅ |

---

## 🛠️ Tech Stack

**Backend**
- Node.js + Express.js
- SQLite (via `better-sqlite3`) — zero-config, file-based database
- JWT authentication
- express-validator for input validation
- bcryptjs for password hashing

**Frontend**
- React 18 + Vite
- React Router v6
- Axios for API calls
- date-fns for date formatting
- Google Fonts: Syne + DM Sans

**Deployment**
- Railway (full-stack, single service)

---

## 📦 Local Setup

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd task-manager

# Install all dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET to a random string

# Start backend (port 5000)
npm run dev:backend

# In another terminal, start frontend (port 5173)
npm run dev:frontend
```

Open http://localhost:5173

---

## 🌐 Deploy to Railway

### One-click deploy

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repository
4. Add environment variables in Railway dashboard:
   ```
   NODE_ENV=production
   JWT_SECRET=<strong-random-secret>
   ```
5. Railway auto-detects `railway.toml` and builds + deploys

Railway will:
- Run `npm run install:all && npm run build` (installs deps + builds React)
- Serve both API and frontend from port defined by `$PORT`
- The Express server serves the React build for all non-API routes

### Environment Variables (Railway)
| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Long random string for signing JWTs |
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | Auto | Set by Railway |

---

## 🗄️ Database Schema

```sql
users         — id, name, email, password, role, created_at
projects      — id, name, description, status, owner_id, timestamps
project_members — project_id, user_id, role (admin/member)
tasks         — id, title, description, status, priority, project_id, assignee_id, creator_id, due_date, timestamps
comments      — id, task_id, user_id, content, created_at
activity_log  — id, user_id, action, entity_type, entity_id, details, created_at
```

---

## 📡 API Reference

### Auth
```
POST /api/auth/signup   — Register new user
POST /api/auth/login    — Login
GET  /api/auth/me       — Get current user (auth required)
PUT  /api/auth/profile  — Update profile (auth required)
GET  /api/auth/users    — List all users (auth required)
```

### Projects
```
GET    /api/projects          — List my projects
POST   /api/projects          — Create project (admin only)
GET    /api/projects/:id      — Get project details + members + stats
PUT    /api/projects/:id      — Update project (project admin)
DELETE /api/projects/:id      — Delete project (project admin)
POST   /api/projects/:id/members         — Add member
DELETE /api/projects/:id/members/:userId — Remove member
```

### Tasks
```
GET    /api/projects/:pId/tasks        — List tasks (filterable)
POST   /api/projects/:pId/tasks        — Create task
GET    /api/projects/:pId/tasks/:id    — Get task + comments
PUT    /api/projects/:pId/tasks/:id    — Update task
DELETE /api/projects/:pId/tasks/:id    — Delete task
POST   /api/projects/:pId/tasks/:id/comments — Add comment
```

### Dashboard
```
GET /api/dashboard — Aggregated stats, tasks, activity
```

---

## 🎥 Demo Script (2–5 min video)

1. **Signup** as Admin → explore empty dashboard
2. **Create a project** → name it "Website Redesign"
3. **Create tasks** — vary priorities and due dates (set one overdue)
4. **Add a member** — signup as Member in another tab, add them
5. **Assign tasks** to the member
6. **Switch to Member account** — show limited access (can't create projects)
7. **Update task status** — drag through kanban stages
8. **Add a comment** on a task
9. **Show Dashboard** — stats, overdue warning, progress bars
10. **Show List view** with filters

---

## 📁 Project Structure

```
task-manager/
├── backend/
│   ├── middleware/
│   │   └── auth.js          # JWT auth + role guards
│   ├── models/
│   │   └── db.js            # SQLite setup + schema
│   ├── routes/
│   │   ├── auth.js          # Signup, login, profile
│   │   ├── projects.js      # Project CRUD + members
│   │   ├── tasks.js         # Task CRUD + comments
│   │   └── dashboard.js     # Aggregated stats
│   ├── server.js            # Express app entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   └── ProjectDetail.jsx
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── api.js           # Axios API client
│   │   ├── App.jsx          # Router
│   │   └── index.css        # Design system
│   └── package.json
├── railway.toml             # Railway deployment config
├── package.json             # Root scripts
└── README.md
```
