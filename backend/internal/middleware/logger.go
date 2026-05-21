package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

// SetupLogger initializes Fiber request logging middleware
func SetupLogger() fiber.Handler {
	return logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path} ${error}\n",
	})
}
