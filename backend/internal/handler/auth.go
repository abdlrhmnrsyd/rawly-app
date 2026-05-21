package handler

import (
	"errors"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type AuthHandler struct {
	authService service.AuthService
}

func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token"`
}

var emailRegex = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,4}$`)

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req registerReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request payload", fiber.StatusBadRequest)
	}

	// Validations
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Username == "" || req.Email == "" || req.Password == "" {
		return utils.SendError(c, "Username, email, and password are required", fiber.StatusBadRequest)
	}

	if len(req.Username) < 3 || len(req.Username) > 30 {
		return utils.SendError(c, "Username must be between 3 and 30 characters", fiber.StatusBadRequest)
	}

	if !emailRegex.MatchString(req.Email) {
		return utils.SendError(c, "Invalid email address format", fiber.StatusBadRequest)
	}

	if len(req.Password) < 6 {
		return utils.SendError(c, "Password must be at least 6 characters long", fiber.StatusBadRequest)
	}

	user, err := h.authService.Register(req.Username, req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrUsernameTaken) || errors.Is(err, service.ErrEmailTaken) {
			return utils.SendError(c, err.Error(), fiber.StatusConflict)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Registration successful", fiber.Map{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
	}, fiber.StatusCreated)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req loginReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request payload", fiber.StatusBadRequest)
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return utils.SendError(c, "Email and password are required", fiber.StatusBadRequest)
	}

	accessToken, refreshToken, user, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCreds) {
			return utils.SendError(c, err.Error(), fiber.StatusUnauthorized)
		}
		if errors.Is(err, service.ErrUserBanned) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Login successful", fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user": fiber.Map{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
			"avatar":   user.Avatar,
		},
	}, fiber.StatusOK)
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req refreshReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request payload", fiber.StatusBadRequest)
	}

	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if req.RefreshToken == "" {
		return utils.SendError(c, "Refresh token is required", fiber.StatusBadRequest)
	}

	accessToken, refreshToken, err := h.authService.Refresh(req.RefreshToken)
	if err != nil {
		if errors.Is(err, service.ErrTokenExpired) {
			return utils.SendError(c, err.Error(), fiber.StatusUnauthorized)
		}
		if errors.Is(err, service.ErrUserBanned) {
			return utils.SendError(c, err.Error(), fiber.StatusForbidden)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Tokens refreshed successfully", fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}, fiber.StatusOK)
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req refreshReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request payload", fiber.StatusBadRequest)
	}

	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if req.RefreshToken == "" {
		return utils.SendError(c, "Refresh token is required to sign out", fiber.StatusBadRequest)
	}

	if err := h.authService.Logout(req.RefreshToken); err != nil {
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Logout successful", nil, fiber.StatusOK)
}
