# rawly-app Backend API (Production-Ready Golang + PostgreSQL)

Welcome to the backend API of **rawly-app**, a social media web application tailored for mobile users (specifically built to interface with Flutter clients). The stack uses **Golang**, **Fiber v2**, **PostgreSQL**, and **GORM** in a modular monolith design following the Service-Repository pattern.

---

## Technical Stack & Features
- **Golang (v1.21+)** & **Fiber v2** for extremely fast, low-overhead HTTP performance.
- **PostgreSQL** & **GORM** object-relational mapping.
- **JWT & Database-backed Refresh Token Rotation** for secure stateful authentication sessions.
- **Bcrypt password hashing** for secure user credential storage.
- **Secure Local Storage Uploads** incorporating byte magic-number sniffing (MIME type verification) to prevent extension-spoofing attacks.
- **Comprehensive Middlewares**: CORS, IP Rate Limiting, Request Logger, and Custom Security Headers (Helmet equivalents).
- **Graceful Shutdown**: Intercepts OS signals (SIGINT, SIGTERM) to resolve in-flight requests and cleanly close database pools.
- **Containerization**: Fully configured `Dockerfile` and `docker-compose.yml` for unified micro-environment deployment.

---

## Directory Structure
```
rawly-app/
├── cmd/
│   └── api/
│       └── main.go           # Entrypoint: Config loader, DB bootstrap, Router config, Signal handler
├── internal/
│   ├── config/
│   │   └── config.go         # Dotenv environmental configuration parser
│   ├── db/
│   │   └── db.go             # GORM Postgres connection pool and migration runner
│   ├── middleware/
│   │   ├── auth.go           # JWT authorization verification
│   │   ├── cors.go           # Cross-Origin Resource Sharing rules
│   │   ├── logger.go         # Request latency formatting logs
│   │   ├── rate_limit.go     # DOS IP-limiting blocker
│   │   └── secure.go         # Content safety header injection
│   ├── model/
│   │   ├── user.go           # Users table schema and relations
│   │   ├── post.go           # Posts table schema and relationships
│   │   ├── comment.go        # Comments table schema
│   │   ├── like.go           # Likes junction with unique indexes
│   │   ├── follow.go         # Follow relations between user entities
│   │   ├── notification.go   # User activity log logs
│   │   ├── refresh_token.go  # Session persistent DB tokens
│   │   └── report.go         # Admin moderation content flags
│   ├── repository/           # Data access layers (raw query optimizations)
│   ├── service/              # Logic domain layers (cryptography, validations)
│   ├── handler/              # HTTP controllers (JSON binding, route mapping)
│   └── utils/
│       ├── response.go       # Consistent JSON API response templates
│       ├── token.go          # Cryptographic hashing & token generation
│       └── upload.go         # MIME sniffer & secure saving system
├── uploads/                  # Local storage path (mounted to host in Docker)
│   ├── avatars/
│   ├── posts/
│   └── videos/
├── .env.example              # Variables distribution configuration template
├── .env                      # Local runtime parameters config file
├── Dockerfile                # Minimal multi-stage container builder
└── docker-compose.yml        # PostgreSQL & API stack runtime
```

---

## Database Schema & Indexing Recommendations

To support fast reads at scale, GORM is configured to generate UUID primary keys, cascade deletions, and index foreign key links.

### Critical Indexes Applied:
1. **`users`**: Unique indexes on `username` and `email` for immediate lookup during login/registration.
2. **`likes`**: Unique composite index `idx_user_post` on `(user_id, post_id)` to enforce singular likes and speed up likes lookups.
3. **`follows`**: Unique composite index `idx_follower_following` on `(follower_id, following_id)` to speed up follow checks.
4. **`posts`**: Single column index on `user_id` to quickly load profiles.
5. **`comments`**: Indexes on `post_id` and `user_id`.
6. **`notifications`**: Index on `user_id` to speed up inbox retrieval.

---

## Setup & Running the Project

### Running with Docker Compose (Recommended)
This compiles the binary and launches a PostgreSQL database in isolated networks.

1. Clone the project code.
2. Build and launch the environment:
   ```bash
   docker compose up --build -d
   ```
3. The API will now listen on port `8080` (e.g., `http://localhost:8080`).

### Running Locally
To launch locally without Docker, you will need a running PostgreSQL database:

1. Install Golang (v1.21+).
2. Install dependencies:
   ```bash
   go mod download
   ```
3. Copy configuration variables:
   ```bash
   cp .env.example .env
   ```
   *Modify the DB fields in `.env` to match your local Postgres setup.*
4. Start the server:
   ```bash
   go run cmd/api/main.go
   ```

---

## API Documentation & Examples

All requests return a consistent JSON response:

**Success Response Format:**
```json
{
  "success": true,
  "message": "Success notification details",
  "data": { ... }
}
```

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error details warning"
}
```

### 1. Authentication

#### Register User
- **Endpoint**: `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "johndoe@gmail.com",
    "password": "securepassword123"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
      "username": "johndoe",
      "email": "johndoe@gmail.com",
      "role": "user"
    }
  }
  ```

#### Login User
- **Endpoint**: `POST /api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "johndoe@gmail.com",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "887a0dbd3f7ea4cb7605d898a44d0818..."
    }
  }
  ```

#### Rotate Refresh Token
- **Endpoint**: `POST /api/auth/refresh`
- **Request Body**:
  ```json
  {
    "refresh_token": "887a0dbd3f7ea4cb7605d898a44d0818..."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Tokens refreshed successfully",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "a1b2c3d4e5f6g7h8..."
    }
  }
  ```

#### Sign Out User
- **Endpoint**: `POST /api/auth/logout`
- **Request Body**:
  ```json
  {
    "refresh_token": "a1b2c3d4e5f6g7h8..."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logout successful"
  }
  ```

---

### 2. User Profiles & Follows

#### Retrieve Profile (Public)
- **Endpoint**: `GET /api/users/profile/:username`
- **Headers**: `Authorization: Bearer <token>` (Optional - pass token to return if current user follows them)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
      "id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
      "username": "johndoe",
      "email": "johndoe@gmail.com",
      "avatar": "/uploads/avatars/550e8400-e29b-41d4-a716-446655440000.png",
      "bio": "Photographer based in Jakarta",
      "followers_count": 142,
      "following_count": 98,
      "posts_count": 12,
      "is_following": false,
      "is_banned": false
    }
  }
  ```

#### Edit Profile (Protected)
- **Endpoint**: `PUT /api/users/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "username": "johndoe_updated",
    "email": "johndoe@gmail.com",
    "bio": "New profile biography"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
      "username": "johndoe_updated",
      "email": "johndoe@gmail.com",
      "bio": "New profile biography"
    }
  }
  ```

#### Upload Avatar (Protected)
- **Endpoint**: `POST /api/users/avatar`
- **Headers**: `Authorization: Bearer <token>`
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `avatar`: `<file-payload>` (supports JPEG, PNG, WEBP, GIF up to configured limit)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Avatar uploaded successfully",
    "data": {
      "avatar_url": "/uploads/avatars/e00aef48-18e3-4d43-a212-32b0f49c0d29.png"
    }
  }
  ```

#### Follow User (Protected)
- **Endpoint**: `POST /api/users/follow/:uuid`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User followed successfully"
  }
  ```

---

### 3. Posts & Feed

#### Create Post (Protected)
- **Endpoint**: `POST /api/posts`
- **Headers**: `Authorization: Bearer <token>`
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `caption`: "Check out my new studio update!"
  - `media`: `<file-payload>` (image or video up to configured limit)
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "data": {
      "id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
      "user_id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
      "caption": "Check out my new studio update!",
      "media_url": "/uploads/posts/32a11bdf-45fb-42be-bc77-9ff5a0c32b50.png",
      "media_type": "image",
      "created_at": "2026-05-21T23:55:00Z",
      "updated_at": "2026-05-21T23:55:00Z"
    }
  }
  ```

#### Get Homepage Feed (Public / Paginated)
- **Endpoint**: `GET /api/posts?page=1&limit=10`
- **Headers**: `Authorization: Bearer <token>` (Optional - to populate `liked_by_me` fields)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Homepage feed retrieved successfully",
    "data": [
      {
        "id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
        "caption": "Check out my new studio update!",
        "media_url": "/uploads/posts/32a11bdf-45fb-42be-bc77-9ff5a0c32b50.png",
        "media_type": "image",
        "created_at": "2026-05-21T23:55:00Z",
        "user_id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
        "username": "johndoe",
        "avatar": "/uploads/avatars/e00aef48-18e3-4d43-a212-32b0f49c0d29.png",
        "likes_count": 24,
        "comments_count": 3,
        "liked_by_me": true
      }
    ]
  }
  ```

---

### 4. Social Interactions

#### Like / Unlike Post (Protected)
- **Endpoint**: `POST /api/posts/:id/like` and `POST /api/posts/:id/unlike`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Post liked successfully"
  }
  ```

#### Get Comments on Post (Public / Paginated)
- **Endpoint**: `GET /api/posts/:id/comments?page=1&limit=20`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Comments retrieved successfully",
    "data": [
      {
        "id": "893c52e8-d1df-4b45-a7b6-96b6fb58f6fe",
        "user_id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
        "post_id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
        "content": "Wow, looks incredible!",
        "created_at": "2026-05-21T23:58:00Z",
        "user": {
          "id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
          "username": "janedoe",
          "avatar": "/uploads/avatars/default.png"
        }
      }
    ]
  }
  ```

#### Get Notifications (Protected / Paginated)
- **Endpoint**: `GET /api/notifications?page=1&limit=20`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Notifications retrieved successfully",
    "data": [
      {
        "id": "1e8c52e8-ffff-4b45-a7b6-96b6fb58f6fe",
        "user_id": "e8a2a5ef-e6c1-417f-a648-261907cb5cf4",
        "actor_id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
        "type": "comment",
        "reference_id": "893c52e8-d1df-4b45-a7b6-96b6fb58f6fe",
        "is_read": false,
        "created_at": "2026-05-21T23:58:00Z",
        "actor": {
          "id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
          "username": "janedoe",
          "avatar": "/uploads/avatars/default.png"
        }
      }
    ]
  }
  ```

---

### 5. Administration & Moderation

#### Ban User (Protected - Admin Only)
- **Endpoint**: `POST /api/admin/users/:id/ban`
- **Headers**: `Authorization: Bearer <admin-token>`
- **Request Body**:
  ```json
  {
    "is_banned": true
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User account has been successfully banned"
  }
  ```

#### Report Post (Protected - Any User)
- **Endpoint**: `POST /api/posts/:id/report`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "reason": "Inappropriate content violation"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Post reported successfully for administrative review",
    "data": {
      "id": "fa2b545f-4a3d-4c3e-8212-32b0f49c0d29",
      "reporter_id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
      "post_id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
      "reason": "Inappropriate content violation",
      "created_at": "2026-05-21T23:59:00Z"
    }
  }
  ```

#### View Flagged Reports (Protected - Admin Only)
- **Endpoint**: `GET /api/admin/reports?page=1&limit=20`
- **Headers**: `Authorization: Bearer <admin-token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Flagged reports retrieved successfully",
    "data": [
      {
        "id": "fa2b545f-4a3d-4c3e-8212-32b0f49c0d29",
        "reporter_id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
        "post_id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
        "reason": "Inappropriate content violation",
        "created_at": "2026-05-21T23:59:00Z",
        "reporter": {
          "id": "14f2a5ef-a3b1-40ff-c948-221907ab5df9",
          "username": "janedoe"
        },
        "post": {
          "id": "4b684cb3-00e9-4e78-bc5a-e3250b73c9f2",
          "caption": "Check out my new studio update!",
          "media_url": "/uploads/posts/32a11bdf-45fb-42be-bc77-9ff5a0c32b50.png"
        }
      }
    ]
  }
  ```

---

## Production Security Best Practices Implemented
1. **Password Hashing**: Uses `bcrypt` with default cost factor. Plaintext passwords are never saved.
2. **Access Token Lifespan**: Signed JWTs decay in 15 minutes, limiting key compromise scopes.
3. **Database refresh token rotation**: Regenerates a unique cryptographic refresh key every login/rotation event. Old keys are immediately pruned, preventing token-replay attacks.
4. **MIME Sniffing**: Uses `http.DetectContentType` to inspect binary files headers rather than trusting HTTP headers or extensions. Prevents code injection via disguised extensions.
5. **Rate Limiting**: Rate limits IP addresses dynamically based on configuration values.
6. **SQL Injection mitigation**: GORM parameters binding natively wraps inputs, avoiding raw SQL joins vulnerabilities.
7. **Banned Session Eviction**: Banning a user invalidates all their database refresh tokens immediately, evicting active sessions on subsequent request executions.

---

## Production Deployment Guide (Ubuntu Server 20.04/22.04 LTS)

### Phase 1: Install Docker & Nginx
On your clean Ubuntu server, install prerequisites:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and log back in to apply group permissions
```

### Phase 2: Setup Project Files
```bash
cd /var/www
sudo git clone https://github.com/your-username/rawly-app-backend.git rawly-app
cd rawly-app

# Create folder directories and verify permissions
mkdir -p uploads/avatars uploads/posts uploads/videos
sudo chown -R 1000:1000 uploads # Match user inside Docker container if running unprivileged

# Copy production env settings
cp .env.example .env
nano .env # Adjust settings: set ENV=production, API_URL=https://api.rawly-app.com, etc.
```

### Phase 3: Start Services
```bash
docker compose up -d --build
```
Ensure containers are running successfully:
```bash
docker compose ps
docker compose logs -f api
```

### Phase 4: Configure UFW Firewall
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Phase 5: Nginx Reverse Proxy with SSL (Let's Encrypt)
Configure Nginx to proxy `https://api.rawly-app.com` directly into container port `8080`.

1. Create Nginx config:
   ```bash
   sudo nano /etc/nginx/sites-available/rawly-app
   ```
2. Paste configuration template:
   ```nginx
   server {
       listen 80;
       server_name api.rawly-app.com;

       # Max body size (match MAX_MEDIA_SIZE_MB config)
       client_max_body_size 60M;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Enable website configuration and reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/rawly-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. Install Certbot for free SSL validation:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.rawly-app.com
   ```
   *Follow prompts. Select automated redirect of HTTP traffic to HTTPS.*

5. Verify renewal scheduler service:
   ```bash
   sudo systemctl status certbot.timer
   ```
   *The system is now fully deployed, secured with SSL, firewalled, and online!*
