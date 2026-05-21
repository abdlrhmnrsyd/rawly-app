package utils

import (
	"github.com/gofiber/fiber/v2"
)

type SuccessResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// SendSuccess sends a standardized 2xx/3xx JSON success response
func SendSuccess(c *fiber.Ctx, message string, data interface{}, statusCode ...int) error {
	status := fiber.StatusOK
	if len(statusCode) > 0 {
		status = statusCode[0]
	}

	return c.Status(status).JSON(SuccessResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// SendError sends a standardized 4xx/5xx JSON error response
func SendError(c *fiber.Ctx, message string, statusCode ...int) error {
	status := fiber.StatusBadRequest
	if len(statusCode) > 0 {
		status = statusCode[0]
	}

	return c.Status(status).JSON(ErrorResponse{
		Success: false,
		Message: message,
	})
}
