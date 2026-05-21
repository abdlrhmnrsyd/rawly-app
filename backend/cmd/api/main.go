package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/db"
	"github.com/rawly-app/backend/internal/handler"
	"github.com/rawly-app/backend/internal/middleware"
	"github.com/rawly-app/backend/internal/repository"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

func main() {
	log.Println("Starting rawly-app API service...")

	// 1. Load configurations
	cfg := config.LoadConfig()

	// 2. Setup database postgres connection & run auto migrations
	dbConn, err := db.InitDB(cfg)
	if err != nil {
		log.Fatalf("Database initialization error: %v", err)
	}

	// 3. Ensure target local storage upload folders exist
	uploadFolders := []string{
		"uploads/avatars",
		"uploads/posts",
		"uploads/videos",
	}
	for _, folder := range uploadFolders {
		if err := os.MkdirAll(folder, 0755); err != nil {
			log.Fatalf("Failed to create upload storage directory %s: %v", folder, err)
		}
	}

	// 4. Initialize Fiber application with custom global error handler
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			var e *fiber.Error
			if errors.As(err, &e) {
				code = e.Code
			}
			return utils.SendError(c, err.Error(), code)
		},
		BodyLimit: 60 * 1024 * 1024, // Set body limit to 60MB to support video uploads
	})

	// 5. Register Global Middlewares
	app.Use(middleware.SetupLogger())
	app.Use(middleware.SetupCORS())
	app.Use(middleware.SetupSecurityHeaders())
	app.Use(middleware.SetupRateLimiter(cfg))

	// 6. Serve static uploads folder
	app.Static("/uploads", "./uploads")

	// 7. Instantiate repositories
	authRepo := repository.NewAuthRepository(dbConn)
	userRepo := repository.NewUserRepository(dbConn)
	postRepo := repository.NewPostRepository(dbConn)
	socialRepo := repository.NewSocialRepository(dbConn)
	adminRepo := repository.NewAdminRepository(dbConn)

	// 8. Instantiate services
	authService := service.NewAuthService(cfg, authRepo, userRepo)
	userService := service.NewUserService(userRepo, socialRepo)
	postService := service.NewPostService(postRepo, userRepo)
	socialService := service.NewSocialService(socialRepo, postRepo)
	adminService := service.NewAdminService(adminRepo, postRepo)

	// 9. Instantiate handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(cfg, userService)
	postHandler := handler.NewPostHandler(cfg, postService)
	socialHandler := handler.NewSocialHandler(socialService)
	adminHandler := handler.NewAdminHandler(adminService)

	// 10. Register API Endpoints
	api := app.Group("/api")

	// Auth Group
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)

	// Users Group (Public endpoints with optional authentications checked inline)
	users := api.Group("/users")
	users.Get("/profile/:username", userHandler.GetProfile)
	users.Get("/profile/:username/posts", postHandler.GetUserPosts)

	// Posts Group (Public endpoints)
	posts := api.Group("/posts")
	posts.Get("/", postHandler.GetFeed)
	posts.Get("/:id", postHandler.GetPost)
	posts.Get("/:id/comments", socialHandler.GetComments)

	// Protected Endpoints Group (Auth required)
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(cfg))

	// User Auth Routes
	protected.Get("/users/me", userHandler.GetMe)
	protected.Put("/users/profile", userHandler.EditProfile)
	protected.Post("/users/avatar", userHandler.UploadAvatar)
	protected.Post("/users/follow/:id", userHandler.Follow)
	protected.Post("/users/unfollow/:id", userHandler.Unfollow)

	// Post Auth Routes
	protected.Post("/posts", postHandler.CreatePost)
	protected.Delete("/posts/:id", postHandler.DeletePost)

	// Social Auth Routes
	protected.Post("/posts/:id/like", socialHandler.LikePost)
	protected.Post("/posts/:id/unlike", socialHandler.UnlikePost)
	protected.Post("/posts/:id/comments", socialHandler.AddComment)
	protected.Get("/notifications", socialHandler.GetNotifications)
	protected.Post("/notifications/read", socialHandler.MarkNotificationsRead)
	protected.Post("/posts/:id/report", adminHandler.ReportPost)

	// Admin Moderation Routes
	admin := protected.Group("/admin")
	admin.Post("/users/:id/ban", adminHandler.BanUser)
	admin.Get("/reports", adminHandler.GetReports)
	admin.Delete("/posts/:id", adminHandler.DeletePostOverride)

	// Handle unknown routes
	app.Use(func(c *fiber.Ctx) error {
		return utils.SendError(c, "Endpoint not found", fiber.StatusNotFound)
	})

	// 11. Graceful Shutdown orchestration
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		port := cfg.Port
		log.Printf("Server listening on port %s in %s mode\n", port, cfg.Env)
		if err := app.Listen(":" + port); err != nil {
			log.Printf("Server shut down with error: %v\n", err)
		}
	}()

	// Wait for OS shutdown signals
	sig := <-shutdownChan
	log.Printf("Received termination signal: %s. Cleaning up and shutting down...\n", sig)

	// Grace period for requests resolution
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Printf("Forced server shutdown error: %v\n", err)
	}

	sqlDB, err := dbConn.DB()
	if err == nil {
		if err := sqlDB.Close(); err != nil {
			log.Printf("Error closing database connections pool: %v\n", err)
		} else {
			log.Println("Database connection pool closed successfully")
		}
	}

	log.Println("Rawly app backend shutdown completed gracefully.")
}
