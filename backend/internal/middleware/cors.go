package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// SetupCORS configures cross-origin policy parameters
func SetupCORS() fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     "*", // In production, scope this to mobile applications and api domains
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: false,
	})
}
