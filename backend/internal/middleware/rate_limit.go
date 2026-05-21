package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/utils"
)

// SetupRateLimiter initializes rate limit controls based on configuration settings
func SetupRateLimiter(cfg *config.Config) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        cfg.RateLimitMax,
		Expiration: time.Duration(cfg.RateLimitDurationSec) * time.Second,
		LimitReached: func(c *fiber.Ctx) error {
			return utils.SendError(c, "Too many requests. Please try again later.", fiber.StatusTooManyRequests)
		},
	})
}
