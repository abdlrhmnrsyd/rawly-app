# Rawly App API Documentation

Dokumentasi ini menjelaskan seluruh API endpoint yang tersedia pada backend **Rawly App**. Format response API menggunakan standar envelope JSON yang konsisten untuk mempermudah integrasi dengan **Flutter** (menggunakan package seperti `dio` atau `http`).

---

## 📌 Ketentuan Umum & Konvensi

### 1. Base URL
* **Lokal / Development:** `http://localhost:8080/api`
* **Production:** (Menyesuaikan dengan URL deployment Railway Anda nantinya)

### 2. Format Response Sukses (2xx / 3xx)
Semua response sukses akan dikembalikan dengan envelope berikut:
```json
{
  "success": true,
  "message": "Deskripsi pesan sukses",
  "data": {} // Bisa berupa Object, Array, atau null tergantung endpoint
}
```

### 3. Format Response Error (4xx / 5xx)
Semua response error memiliki format terpadu:
```json
{
  "success": false,
  "message": "Deskripsi detail pesan error"
}
```

### 4. Autentikasi (JWT)
Untuk endpoint yang memerlukan autentikasi (**Protected**), Anda wajib menyertakan token akses pada header HTTP:
* **Header Key:** `Authorization`
* **Header Value:** `Bearer <your_access_token>`

---

## 🔐 1. Authentication Endpoints
Grup endpoint untuk registrasi, login, logout, dan perpanjangan token.

### 1.1 Register User
* **Method & Path:** `POST /auth/register`
* **Auth:** Public
* **Request Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "username": "rasyid123",
    "email": "rasyid@example.com",
    "password": "securepassword123"
  }
  ```
  * *Validasi:* Username minimal 3-30 karakter. Password minimal 6 karakter.
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "username": "rasyid123",
      "email": "rasyid@example.com",
      "role": "user"
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Payload tidak valid atau validasi input gagal.
  * `409 Conflict`: Username atau Email sudah terdaftar.

---

### 1.2 Login User
* **Method & Path:** `POST /auth/login`
* **Auth:** Public
* **Request Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "rasyid@example.com",
    "password": "securepassword123"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
      "refresh_token": "cf5bb6ad-cb50-4822-b054..."
    }
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Email atau password salah.
  * `403 Forbidden`: Akun pengguna diblokir (banned).

---

### 1.3 Refresh Access Token
Mendapatkan Access Token baru menggunakan Refresh Token yang valid tanpa perlu login ulang.
* **Method & Path:** `POST /auth/refresh`
* **Auth:** Public
* **Request Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "refresh_token": "cf5bb6ad-cb50-4822-b054..."
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Tokens refreshed successfully",
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
      "refresh_token": "82a884f3-adcf-4a3d-a41e..."
    }
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Refresh token tidak valid atau kadaluarsa.
  * `403 Forbidden`: Pengguna yang memiliki token sedang di-banned.

---

### 1.4 Logout
Menghapus session Refresh Token dari database server.
* **Method & Path:** `POST /auth/logout`
* **Auth:** Public
* **Request Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "refresh_token": "cf5bb6ad-cb50-4822-b054..."
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logout successful",
    "data": null
  }
  ```

---

## 👤 2. User & Profile Endpoints
Endpoint untuk melihat profil, mengedit info profil, mengganti avatar, serta follow/unfollow user lain.

### 2.1 Get Profile Detail
Mendapatkan info detail profil user tertentu beserta jumlah statistik. Jika header `Authorization` disertakan, server akan mengecek apakah Anda sudah mengikuti user tersebut (`is_following`).
* **Method & Path:** `GET /users/profile/:username`
* **Auth:** Public (Optional Bearer Token untuk status `is_following`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
      "id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "username": "rasyid123",
      "email": "rasyid@example.com",
      "avatar": "/uploads/avatars/avatar_1716301234.png", // Bisa null
      "bio": "Mobile developer enthusiast", // Bisa null
      "followers_count": 142,
      "following_count": 89,
      "posts_count": 12,
      "is_following": false,
      "is_banned": false
    }
  }
  ```
* **Error Responses:**
  * `404 Not Found`: Username tidak ditemukan.

---

### 2.2 Edit Profile Info
Mengedit data profil seperti username, email, dan bio.
* **Method & Path:** `PUT /users/profile`
* **Auth:** Protected
* **Request Body:**
  ```json
  {
    "username": "rasyid_new",
    "email": "rasyid@example.com",
    "bio": "Flutter & Go developer"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "username": "rasyid_new",
      "email": "rasyid@example.com",
      "bio": "Flutter & Go developer"
    }
  }
  ```
* **Error Responses:**
  * `409 Conflict`: Username baru sudah digunakan oleh orang lain.

---

### 2.3 Upload Avatar
Mengganti foto profil dengan mengunggah gambar.
* **Method & Path:** `POST /users/avatar`
* **Auth:** Protected
* **Request Headers:**
  * `Content-Type: multipart/form-data`
* **Request Body (Multipart Form):**
  * `avatar`: File Gambar (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` | Max 5MB)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Avatar uploaded successfully",
    "data": {
      "avatar_url": "/uploads/avatars/e30b666a-12e0-4034-8c67-27b0553755cf_avatar.png"
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: File tidak disertakan, ukuran terlalu besar, atau ekstensi tidak didukung.

---

### 2.4 Follow User
Mengikuti pengguna lain.
* **Method & Path:** `POST /users/follow/:id` (ID berupa UUID dari user target)
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User followed successfully",
    "data": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Mencoba follow diri sendiri atau sudah mem-follow target.

---

### 2.5 Unfollow User
Berhenti mengikuti pengguna lain.
* **Method & Path:** `POST /users/unfollow/:id` (ID berupa UUID dari user target)
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User unfollowed successfully",
    "data": null
  }
  ```

---

## 📝 3. Post Endpoints
Endpoint untuk membuat, menghapus, melihat postingan single, serta menampilkan feed homepage dengan filter paginasi.

### 3.1 Create Post (Upload Image/Video)
Membuat postingan baru berupa gambar atau video ber-caption.
* **Method & Path:** `POST /posts`
* **Auth:** Protected
* **Request Headers:**
  * `Content-Type: multipart/form-data`
* **Request Body (Multipart Form):**
  * `caption`: `Jalan-jalan sore` (String, opsional)
  * `media`: File Gambar atau Video (`.jpg`, `.png`, `.mp4`, `.mov`, dll. | Max 50MB)
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "data": {
      "id": "fa80bc77-a82f-48d0-ba09-322194c64391",
      "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "caption": "Jalan-jalan sore",
      "media_url": "/uploads/posts/fa80bc77-a82f-48d0-ba09-322194c64391.png", // Atau /uploads/videos/ jika video
      "media_type": "image", // 'image' atau 'video'
      "created_at": "2026-05-21T23:30:00Z",
      "updated_at": "2026-05-21T23:30:00Z"
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: File media wajib diisi atau tipe file tidak sesuai ketentuan.

---

### 3.2 Get Home Feed (Paginasi)
Menampilkan postingan-postingan global terbaru (diurutkan dari yang terbaru). Jika token Bearer dikirim, data akan diperkaya dengan penanda `liked_by_me`.
* **Method & Path:** `GET /posts`
* **Auth:** Public (Optional Bearer Token untuk status `liked_by_me`)
* **Query Parameters:**
  * `page` (opsional): Halaman ke berapa (Default: `1`)
  * `limit` (opsional): Jumlah item per halaman (Default: `10`, Max: `100`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Homepage feed retrieved successfully",
    "data": [
      {
        "id": "fa80bc77-a82f-48d0-ba09-322194c64391",
        "caption": "Jalan-jalan sore",
        "media_url": "/uploads/posts/fa80bc77-a82f-48d0-ba09-322194c64391.png",
        "media_type": "image",
        "created_at": "2026-05-21T23:30:00Z",
        "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
        "username": "rasyid123",
        "avatar": "/uploads/avatars/avatar_1716301234.png",
        "likes_count": 24,
        "comments_count": 5,
        "liked_by_me": true
      }
    ]
  }
  ```

---

### 3.3 Get Single Post
* **Method & Path:** `GET /posts/:id` (ID berupa UUID post)
* **Auth:** Public (Optional Bearer Token untuk status `liked_by_me`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Post retrieved successfully",
    "data": {
      "id": "fa80bc77-a82f-48d0-ba09-322194c64391",
      "caption": "Jalan-jalan sore",
      "media_url": "/uploads/posts/fa80bc77-a82f-48d0-ba09-322194c64391.png",
      "media_type": "image",
      "created_at": "2026-05-21T23:30:00Z",
      "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "username": "rasyid123",
      "avatar": "/uploads/avatars/avatar_1716301234.png",
      "likes_count": 24,
      "comments_count": 5,
      "liked_by_me": false
    }
  }
  ```

---

### 3.4 Get User Posts
Menampilkan seluruh postingan milik seorang user tertentu berdasarkan username.
* **Method & Path:** `GET /users/profile/:username/posts`
* **Auth:** Public (Optional Bearer Token)
* **Query Parameters:**
  * `page` (opsional, Default: `1`)
  * `limit` (opsional, Default: `10`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User posts retrieved successfully",
    "data": [
      {
        "id": "fa80bc77-a82f-48d0-ba09-322194c64391",
        "caption": "Postingan pertama saya",
        "media_url": "/uploads/posts/fa80bc77-a82f-48d0-ba09-322194c64391.png",
        "media_type": "image",
        "created_at": "2026-05-21T23:30:00Z",
        "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
        "username": "rasyid123",
        "avatar": "/uploads/avatars/avatar_1716301234.png",
        "likes_count": 5,
        "comments_count": 0,
        "liked_by_me": false
      }
    ]
  }
  ```

---

### 3.5 Delete Post
Menghapus postingan sendiri (atau post apa saja jika role Anda adalah Admin).
* **Method & Path:** `DELETE /posts/:id`
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Post deleted successfully",
    "data": null
  }
  ```
* **Error Responses:**
  * `403 Forbidden`: Mencoba menghapus postingan milik user lain sedangkan Anda bukan admin.
  * `404 Not Found`: Postingan tidak ditemukan.

---

## 💬 4. Social & Interaction Endpoints
Endpoint untuk interaksi sosial seperti likes, comments, notifikasi, dan pelaporan postingan.

### 4.1 Like Post
Menyukai sebuah postingan. Tindakan ini juga otomatis mengirim notifikasi kepada pemilik postingan.
* **Method & Path:** `POST /posts/:id/like`
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Post liked successfully",
    "data": null
  }
  ```

---

### 4.2 Unlike Post
Membatalkan suka pada postingan.
* **Method & Path:** `POST /posts/:id/unlike`
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Post unliked successfully",
    "data": null
  }
  ```

---

### 4.3 Add Comment
Menambahkan komentar ke sebuah postingan. Tindakan ini juga memicu notifikasi ke pemilik postingan.
* **Method & Path:** `POST /posts/:id/comments`
* **Auth:** Protected
* **Request Body:**
  ```json
  {
    "content": "Keren banget fotonya!"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Comment added successfully",
    "data": {
      "id": "c1a63df9-9029-4702-8a9d-b6a4a034ab11",
      "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "post_id": "fa80bc77-a82f-48d0-ba09-322194c64391",
      "content": "Keren banget fotonya!",
      "created_at": "2026-05-21T23:35:00Z",
      "updated_at": "2026-05-21T23:35:00Z"
    }
  }
  ```

---

### 4.4 Get Comments List
Mendapatkan semua daftar komentar pada suatu postingan.
* **Method & Path:** `GET /posts/:id/comments`
* **Auth:** Public
* **Query Parameters:**
  * `page` (opsional, Default: `1`)
  * `limit` (opsional, Default: `10`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Comments retrieved successfully",
    "data": [
      {
        "id": "c1a63df9-9029-4702-8a9d-b6a4a034ab11",
        "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
        "post_id": "fa80bc77-a82f-48d0-ba09-322194c64391",
        "content": "Keren banget fotonya!",
        "created_at": "2026-05-21T23:35:00Z",
        "updated_at": "2026-05-21T23:35:00Z",
        "user": {
          "id": "e30b666a-12e0-4034-8c67-27b0553755cf",
          "username": "rasyid123",
          "email": "rasyid@example.com",
          "avatar": "/uploads/avatars/avatar_1716301234.png",
          "bio": "Mobile developer enthusiast",
          "role": "user",
          "is_banned": false,
          "created_at": "2026-05-21T23:00:00Z",
          "updated_at": "2026-05-21T23:00:00Z"
        }
      }
    ]
  }
  ```

---

### 4.5 Get User Notifications
Melihat riwayat notifikasi Anda (like, comment, follow).
* **Method & Path:** `GET /notifications`
* **Auth:** Protected
* **Query Parameters:**
  * `page` (opsional, Default: `1`)
  * `limit` (opsional, Default: `10`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Notifications retrieved successfully",
    "data": [
      {
        "id": "0d206fcf-643f-4279-8809-7d84fae1ff83",
        "user_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
        "actor_id": "d0e1b212-0fbc-49a3-a0e2-892410a514d2",
        "type": "like",
        "reference_id": "fa80bc77-a82f-48d0-ba09-322194c64391",
        "is_read": false,
        "created_at": "2026-05-21T23:36:00Z",
        "actor": {
          "id": "d0e1b212-0fbc-49a3-a0e2-892410a514d2",
          "username": "kawan_baik",
          "email": "kawan@example.com",
          "avatar": null,
          "bio": null,
          "role": "user",
          "is_banned": false,
          "created_at": "2026-05-21T23:10:00Z",
          "updated_at": "2026-05-21T23:10:00Z"
        }
      }
    ]
  }
  ```

---

### 4.6 Mark All Notifications as Read
Menandai semua notifikasi Anda yang belum terbaca menjadi sudah dibaca.
* **Method & Path:** `POST /notifications/read`
* **Auth:** Protected
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Notifications marked as read",
    "data": null
  }
  ```

---

### 4.7 Report Post
Melaporkan suatu postingan.
* **Method & Path:** `POST /posts/:id/report` (ID berupa UUID post)
* **Auth:** Protected
* **Request Body:**
  ```json
  {
    "reason": "Mengandung unsur kekerasan / spam"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Post reported successfully for administrative review",
    "data": {
      "id": "9a0df47a-2544-4861-b4e8-ec588e36780c",
      "reporter_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
      "post_id": "fa80bc77-a82f-48d0-ba09-322194c64391",
      "reason": "Mengandung unsur kekerasan / spam",
      "created_at": "2026-05-21T23:38:00Z"
    }
  }
  ```

---

## 🛠️ 5. Admin & Moderation Endpoints
Endpoint khusus untuk peran `admin` dalam mengelola laporan dan pemblokiran pengguna.

### 5.1 Ban / Unban User
* **Method & Path:** `POST /admin/users/:id/ban` (ID berupa UUID user)
* **Auth:** Protected (Hanya User dengan Role `admin`)
* **Request Body:**
  ```json
  {
    "is_banned": true
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User account has been successfully banned",
    "data": null
  }
  ```

---

### 5.2 Get Reported Posts List
* **Method & Path:** `GET /admin/reports`
* **Auth:** Protected (Hanya User dengan Role `admin`)
* **Query Parameters:**
  * `page` (opsional, Default: `1`)
  * `limit` (opsional, Default: `10`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Flagged reports retrieved successfully",
    "data": [
      {
        "id": "9a0df47a-2544-4861-b4e8-ec588e36780c",
        "reporter_id": "e30b666a-12e0-4034-8c67-27b0553755cf",
        "post_id": "fa80bc77-a82f-48d0-ba09-322194c64391",
        "reason": "Mengandung unsur kekerasan / spam",
        "created_at": "2026-05-21T23:38:00Z",
        "reporter": {
          "id": "e30b666a-12e0-4034-8c67-27b0553755cf",
          "username": "rasyid123"
        },
        "post": {
          "id": "fa80bc77-a82f-48d0-ba09-322194c64391",
          "caption": "Jalan-jalan sore",
          "media_url": "/uploads/posts/fa80bc77-a82f-48d0-ba09-322194c64391.png"
        }
      }
    ]
  }
  ```

---

### 5.3 Force Delete Post (Admin Override)
* **Method & Path:** `DELETE /admin/posts/:id`
* **Auth:** Protected (Hanya User dengan Role `admin`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Post removed by administrative action",
    "data": null
  }
  ```
