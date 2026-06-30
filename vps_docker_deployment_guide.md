# 🚀 BizOS: Hostinger VPS Docker Deployment Guide

Since you have purchased a Hostinger VPS, you have full root access to an Ubuntu/Debian environment. Follow these exact steps to securely and correctly deploy your BizOS Multi-Tenant SaaS using Docker.

## Step 1: Connect to Your VPS
Open your terminal (Mac/Linux) or PowerShell (Windows) and SSH into your Hostinger VPS. You will find the IP address and root password in your Hostinger dashboard.
```bash
ssh root@YOUR_VPS_IP_ADDRESS
```

## Step 2: Install Docker & Docker Compose
Once you are logged into the VPS, run the following commands to install Docker and Docker Compose automatically.

```bash
# Update the system
apt update && apt upgrade -y

# Install Docker automatically using the official script
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify the installation
docker --version
docker compose version
```

## Step 3: Setup the Project Directory
Create a directory for BizOS and navigate into it.

```bash
mkdir -p /opt/bizos
cd /opt/bizos
```

Now, you need to transfer your project files to the VPS. You can either use `git clone` if your code is on GitHub/GitLab, or use `scp` from your local machine.

**Option A (Using Git - Recommended):**
```bash
git clone https://github.com/YOUR_USERNAME/BizOs.git .
cd backend
```

## Step 4: Create Production Environment Variables
Docker Compose relies on an `.env` file for secrets. **Never hardcode secrets in the `docker-compose.yml`.**

Run this command to create and open the `.env.production` file:
```bash
nano .env.production
```

Paste the following configurations into the file, replacing the placeholder values with actual strong passwords and secrets:

```env
# ─── DATABASE ────────────────────────
POSTGRES_USER=bizos_prod
POSTGRES_PASSWORD=generate_a_very_strong_password_here
POSTGRES_DB=bizos_prod
# Connection string (Used by the API/Worker/Bot)
DATABASE_URL=postgresql://bizos_prod:generate_a_very_strong_password_here@postgres:5432/bizos_prod?schema=public&connection_limit=5&pool_timeout=10

# ─── REDIS ───────────────────────────
REDIS_PASSWORD=generate_a_strong_redis_password_here

# ─── SECURITY ────────────────────────
JWT_ACCESS_SECRET=generate_a_random_32_char_string_here_for_access
JWT_REFRESH_SECRET=generate_a_random_32_char_string_here_for_refresh
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# ─── STORAGE (MinIO) ─────────────────
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=bizos_admin
STORAGE_SECRET_KEY=generate_strong_minio_secret_here

# ─── TELEGRAM BOT ────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
```
Press `CTRL+X`, then `Y`, then `Enter` to save and exit.

## Step 5: Start the Production Stack
Your repository is already beautifully structured with a `docker-compose.yml` (base) and a `docker-compose.prod.yml` (overrides). We will merge them together to start the production services.

Run the following command to build the production images and start all containers in the background:

```bash
# Load the environment variables from the file and run docker compose
docker compose --env-file .env.production up -d --build
```

## Step 6: Verify Deployment
Check if all containers are running properly and are healthy:
```bash
docker ps
```
You should see:
- `bizos-postgres`
- `bizos-redis`
- `bizos-minio`
- `bizos-api`
- `bizos-worker`
- `bizos-bot`

To check the API logs to ensure it connected to the database successfully:
```bash
docker logs -f bizos-api
```

## Step 7: Reverse Proxy (Nginx + SSL)
Right now, your API is running on port `3000` of the VPS (e.g., `http://YOUR_VPS_IP:3000`). To map this to `api.yourdomain.com` with HTTPS, you need Nginx and Certbot.

```bash
# Install Nginx & Certbot
apt install nginx certbot python3-certbot-nginx -y
```

Create a new Nginx configuration for your API:
```bash
nano /etc/nginx/sites-available/bizos-api
```

Paste the following:
```nginx
server {
    server_name api.yourdomain.com; # Change this to your actual domain

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Real IP forwarding
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:
```bash
ln -s /etc/nginx/sites-available/bizos-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

Finally, generate the free SSL certificate:
```bash
certbot --nginx -d api.yourdomain.com
```

> [!TIP]
> **Database Migrations**
> Once the containers are running, you need to migrate the database schema. Run this command on the VPS:
> `docker exec -it bizos-api npx prisma migrate deploy`




# BizOS-এর কন্টেইনার ও ভলিউম স্টপ করা
docker compose down -v

# সার্ভারে থাকা সব ডকার কন্টেইনার স্টপ ও ডিলিট করা
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)

# সব ডকার ইমেজ ও ভলিউম মুছে ফেলা (যাতে স্টোরেজ ফাকা হয়)
docker rmi -f $(docker images -aq)
docker volume rm $(docker volume ls -q)

docker exec -it bizos-api node dist/prisma/seed.js

## 🔄 How to Update the Application (Pushing New Code)

Whenever you write new code on your local machine and push it to GitHub, you need to pull those changes and rebuild the containers on your VPS.

### Updating the Backend (API & Worker)
1. Go to the backend directory on your VPS:
   ```bash
   cd /opt/bizos/backend
   ```
2. Pull the latest code from GitHub:
   ```bash
   git pull
   ```
3. Rebuild and restart the containers with the new code:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
4. **(Optional)** If you made any changes to the Prisma schema (`schema.prisma`), you need to apply the migrations to the live database:
   ```bash
   docker exec -it bizos-api npx prisma migrate deploy
   ```

### Updating the Frontend (Next.js UI)
1. Go to the frontend directory on your VPS:
   ```bash
   cd /opt/bizos/frontend
   ```
2. Pull the latest code from GitHub:
   ```bash
   git pull
   ```
3. Rebuild and restart the frontend container:
   ```bash
   docker compose up -d --build
   ```

> **Pro Tip:** Using the `--build` flag ensures Docker reads your latest code changes and creates a fresh image. If you just run `up -d` without `--build`, Docker might use the old cached code!
