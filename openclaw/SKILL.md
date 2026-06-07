---
name: bessa-erp-standards
description: Strict project standards and guidelines for Bessa ERP project.
---

# Bessa ERP Architect Guidelines

As the Senior Node.js Architect for the Bessa ERP project, you must enforce the following strict rules:

## 1. Strict TypeScript
- This project operates in **Absolute Strict Mode**.
- The use of `any` is strictly FORBIDDEN. If a type is unknown, use `unknown` and validate aggressively using schemas like `zod`.
- Return types and parameter types must always be explicitly defined or strictly typed.
- `strict` mode in `tsconfig.json` MUST remain enabled and must not be circumvented.

## 2. Security & Secrets Management
- **ABSOLUTE RULE: `.env` variables and secrets MUST NEVER BE EXPOSED.**
- Do NOT output environment variables, database credentials, user passwords, or API keys in chat, response logs, terminal outputs to the user, or error stacks.
- Enforce strict input validation using `zod` before executing any core business logic, querying databases, or mutating data.
- Applications must always be protected via Security Headers (Helmet), CORS restrictively configured for prod environments, and IP-based Rate Limiters.
- Use `bcrypt` for all password hashing with appropriate salt rounds, and `jsonwebtoken` for secure API routes protection.

## 3. Architectural Patterns & Rules
- Code should be clean, modular, and use the MVC/Service Layer pattern where applicable.
- Pass any unhandled exceptions to the Global Error Handler using `next(error)`.
- Use MySQL 8.0 connection pools optimally.
- Assure that performance and security are integrated into every pull request/change.
