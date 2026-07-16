# 🤝 Contribution Guide — PHYGITRON 360

This document defines the development workflow, rules, and best practices for all contributors.

---

## 🧠 Branching Strategy

We follow a 3-level branching model:

main      → Production (stable)
dev       → Development (integration)
feature/* → Individual features

---

## 🌱 Branch Roles

### 🔴 main
- Production-ready code only
- No direct commits allowed

### 🟡 dev
- Active development branch
- All features are merged here first

### 🟢 feature/*
- Used for individual features
- Example:
  - feature/auth-login
  - feature/source-candidate-api
  - feature/deploy-employee-module

---

## 🔄 Workflow (MANDATORY)

### 1. Start from dev
git checkout dev
git pull origin dev

### 2. Create a feature branch
git checkout -b feature/<feature-name>

### 3. Work on your feature
- Follow module structure
- Keep code clean

git add .
git commit -m "Add: short description"

### 4. Push your branch
git push origin feature/<feature-name>

### 5. Merge into dev
git checkout dev
git merge feature/<feature-name>
git push origin dev

### 6. Delete feature branch
git branch -d feature/<feature-name>

### 7. Release to main (only when stable)
git checkout main
git merge dev
git push origin main

---

## 🚨 Rules (STRICT)

### ❌ DO NOT
- Commit directly to main
- Push broken or untested code
- Mix multiple features in one branch
- Import across modules
- Hardcode secrets

### ✅ ALWAYS
- Pull latest dev before starting
- Use feature branches
- Write clear commit messages
- Follow module structure
- Keep modules independent
- Use events for communication

---

## 🧩 Module Structure

Each module must follow:

modules/<module>/
    routers/
    services/
    repositories/
    models/
    schemas/
    events/

---

## 🚫 Forbidden

from modules.other_module import ...

---

## ✅ Allowed

emit("event.name")

---

## 🧠 Coding Standards

- routers → API endpoints only
- services → business logic
- repositories → database queries
- schemas → validation
- models → database structure

---

## 🔥 Commit Message Format

Add: new feature  
Fix: bug fix  
Update: modification  
Refactor: cleanup  

---

## 🚀 Deployment Flow

feature → dev → main

---

## 🧠 Final Note

PHYGITRON 360 is a modular SaaS platform.

Think in:
- systems
- modules
- scalability

---

## 💡 If unsure

Ask before pushing.