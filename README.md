# BizOs - Backend API ⚙️

The core RESTful API and database management layer for the BizOs ecosystem. It securely processes transactions, manages inventory logic, and syncs data between the web frontend and mobile applications.

## Features ✨

- **RESTful API**: Standardized endpoints for CRUD operations across products, sales, customers, and more.
- **Authentication & Authorization**: Secure JWT-based authentication with role-based access control (Admin, Cashier, Manager).
- **Database Integration**: Prisma ORM configured for robust, scalable relational database modeling.
- **Offline Sync Resolution**: Handles incoming batched requests from offline clients (mobile/web) to resolve conflicts and update centralized records.
- **Reporting Engine**: Generates aggregate sales and inventory data for dashboard visualizations.

## Getting Started 🚀

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Database (SQLite for local dev, PostgreSQL for production)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and set your Database URL and JWT Secrets.
   ```bash
   cp .env.example .env
   ```

3. Setup the Database:
   Generate the Prisma client and run migrations/seeds.
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:5000` (or the port specified in your `.env`).

### Building for Production 📦

To build and run the production server:
```bash
npm run build
npm start
```
*Alternatively, you can use the provided `Dockerfile` and `docker-compose.yml` for containerized deployments.*

## Tech Stack 🛠️

- **Framework**: Node.js, Express.js
- **Database ORM**: Prisma
- **Validation**: Zod
- **Authentication**: JSON Web Tokens (JWT), bcrypt
- **Logging**: Winston, Morgan
- **Containerization**: Docker
