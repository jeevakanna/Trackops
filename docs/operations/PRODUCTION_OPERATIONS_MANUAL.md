# TrackOps - Production Operations Manual & Runbook

**Document ID:** TRK-OPS-V1.0  
**Application:** TrackOps - Comic Stall Management System  
**Version:** v1.0 Production  
**Environment:** Production (`E:\trackops-prod`)  
**Target Audience:** System Administrators, Stall Operators, DevOps Engineers  

---

## 1. System Overview

TrackOps Production v1.0 is a standalone single-user stall management and POS system operating out of `E:\trackops-prod`. It runs on port **5000** and connects to an isolated, dedicated PostgreSQL database named **`trackops_prod`**.

---

## 2. Infrastructure Requirements

- **Operating System:** Windows 10 / Windows 11 (64-bit)
- **Node.js Runtime:** Node.js v20+ / v24+
- **Subsystem:** Windows Subsystem for Linux (WSL2) with Ubuntu
- **Database Engine:** PostgreSQL 18 (Cluster: `18/main` running inside WSL Ubuntu on port 5432)
- **Production URL:** `http://localhost:5000`

---

## 3. Starting and Stopping Services

### 3.1 Standard Automated Startup
1. Open Windows File Explorer and navigate to `E:\trackops-prod`.
2. Double-click [`start_trackops_prod.bat`](file:///E:/trackops-prod/start_trackops_prod.bat).
3. The script will:
   - Verify and start the PostgreSQL service in WSL if it is inactive.
   - Automatically open your default web browser to `http://localhost:5000`.
   - Start the Express production server (`npm run start`).

### 3.2 Manual Command-Line Startup
If launching from PowerShell or Command Prompt:

```cmd
:: 1. Ensure PostgreSQL is active
wsl -u root -d Ubuntu -e service postgresql start

:: 2. Launch production server
cd /d E:\trackops-prod
npm run start
```

### 3.3 Graceful Shutdown
1. Navigate to the terminal window running TrackOps Production.
2. Press `Ctrl + C` and enter `Y` when prompted to terminate batch job.
3. The Express process will close active database connections and terminate cleanly.

---

## 4. Production Database Operations

### 4.1 Connection Details
- **Host:** `localhost` (or `127.0.0.1`)
- **Port:** `5432`
- **Database:** `trackops_prod`
- **Username:** `trackops`
- **Password:** `trackops`
- **Connection URI:** `postgresql://trackops:trackops@localhost:5432/trackops_prod`

### 4.2 Automated Daily Database Backup
To take an instantaneous SQL backup of all catalogue items, sales, purchases, and finance records:

```cmd
wsl -u postgres -d Ubuntu -e pg_dump -U trackops -d trackops_prod > "E:\trackops-prod\backup_trackops_prod_%date:~-4,4%%date:~-7,2%%date:~-10,2%.sql"
```

### 4.3 Database Restoration Procedure
In the event of hardware replacement or disaster recovery:

```cmd
:: 1. Recreate clean database
wsl -u root -d Ubuntu -e sudo -u postgres psql -c "DROP DATABASE IF EXISTS trackops_prod;"
wsl -u root -d Ubuntu -e sudo -u postgres psql -c "CREATE DATABASE trackops_prod OWNER trackops;"

:: 2. Restore from backup file
wsl -u postgres -d Ubuntu -e psql -U trackops -d trackops_prod < "E:\trackops-prod\your_backup_file.sql"
```

---

## 5. Rebuilding Production Frontend

Whenever code modifications or styling updates are made to the React frontend:

```cmd
cd /d E:\trackops-prod
npm run build
```

This compiles, type-checks, and bundles the application into `dist/`. The Express backend immediately serves the updated bundle upon server restart.

---

## 6. Health Monitoring & Diagnostics

### 6.1 API Health Check
Run the following in PowerShell to verify backend availability:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```
**Expected Response:** `@{ ok = $True }`

### 6.2 Port Conflict Resolution
If port `5000` is blocked by another application:
1. Identify the blocking process:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess
   ```
2. Terminate the process or change `PORT=5000` to an alternate port in `E:\trackops-prod\.env`.

### 6.3 WSL Network Connection Troubleshooting
If `ECONNREFUSED 127.0.0.1:5432` appears in server logs:
1. Check if the PostgreSQL cluster is online:
   ```cmd
   wsl -d Ubuntu -e pg_lsclusters
   ```
2. If offline, start it with:
   ```cmd
   wsl -u root -d Ubuntu -e service postgresql start
   ```
