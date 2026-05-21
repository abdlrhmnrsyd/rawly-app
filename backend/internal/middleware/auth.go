package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/utils"
)

// JWTAuth validates the Bearer token and stores claims in fiber Locals
func JWTAuth(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.SendError(c, "Unauthorized: missing authorization header", fiber.StatusUnauthorized)
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return utils.SendError(c, "Unauthorized: invalid token format", fiber.StatusUnauthorized)
		}

		tokenStr := parts[1]
		claims, err := utils.ValidateAccessToken(tokenStr, cfg.JWTSecret)
		if err != nil {
			return utils.SendError(c, "Unauthorized: invalid or expired token", fiber.StatusUnauthorized)
		}

		userIDStr, okSub := claims["sub"].(string)
		roleStr, okRole := claims["role"].(string)
		if !okSub || !okRole {
			return utils.SendError(c, "Unauthorized: invalid token payload structure", fiber.StatusUnauthorized)
		}

		// Inject user context variables into local context for subsequent handlers
		c.Locals("userId", userIDStr)
		c.Locals("userRole", roleStr)

		return c.Next()
	}
}
