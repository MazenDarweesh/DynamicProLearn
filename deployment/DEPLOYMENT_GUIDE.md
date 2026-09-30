# 🚀 LearnDynamicPro Deployment Guide

This guide describes how to build, run, and deploy the **LearnDynamicPro** application (Angular Frontend + .NET 10 Backend packaged in a single production Docker container).

---

## 📋 Prerequisites on the Server / Machine

Ensure the following tools are installed:
1. **Docker Engine** (version 20.10 or higher)
2. **Docker Compose v2** (`docker compose`)

---

## 🛠️ Method 1: Direct Local Build & Run with Docker Compose (Fastest)

To build the latest code locally and run the entire stack (App + SQL Server) in one command:

```bash
# From workspace root:
docker compose -f deployment/docker-compose.yml --env-file deployment/.env.example up -d --build
```

---

## ☁️ Method 2: Building and Pushing to Docker Hub

### 1. Build and Tag Image
```bash
docker build -t mazendarweesh/dynamicprolearn:latest -f deployment/Dockerfile .
```

### 2. Push to Docker Hub
```bash
docker push mazendarweesh/dynamicprolearn:latest
```

### 3. Deploy on Production Server
Copy `deployment/docker-compose.yml` and `deployment/.env.example` (renamed to `.env`) to your server:
```bash
docker compose up -d
```

---

## 💾 Method 2: Deploying via Offline Tar Archive (If not using Docker Hub)

If the server has no internet access or you want to transfer the image manually without uploading it to Docker Hub:

### 1. Save the Image to a Tar File (On your local machine)
After building the image locally (`docker build -t mazendarweesh/dynamicprolearn:latest -f deployment/Dockerfile .`), run:
```bash
docker save -o dynamicprolearn.tar mazendarweesh/dynamicprolearn:latest
```

### 2. Transfer the Archive to the Server
Copy the `dynamicprolearn.tar` and `docker-compose.yml` to the server using `SCP`, `SFTP`, or a USB drive.
```bash
scp dynamicprolearn.tar user@server-ip:/opt/dynamicprolearn/
scp deployment/docker-compose.yml user@server-ip:/opt/dynamicprolearn/
```

### 3. Load the Image on the Server
SSH into the server, navigate to the directory, and load the image:
```bash
cd /opt/dynamicprolearn
docker load -i dynamicprolearn.tar
```

### 4. Run the Containers
```bash
docker compose up -d
```

---

## 🔍 Verification and Logs

### 1. Check Container Status
Verify that both the app and database containers are up and running:
```bash
docker ps
```

### 2. View Application Logs
Check the runtime logs to ensure connection to the database and startup:
```bash
docker logs -f dynamicprolearn-app
```

### 3. Ports Configuration
- **Application**: Accessible on port `8080` (e.g., `http://server-ip:8080`).
- **Database (Internal)**: SQL Server runs internally on port `1433` inside the Docker network.
