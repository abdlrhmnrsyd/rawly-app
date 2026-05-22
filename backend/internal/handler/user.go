package handler

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/service"
	"github.com/rawly-app/backend/internal/utils"
)

type UserHandler struct {
	cfg         *config.Config
	userService service.UserService
}

func NewUserHandler(cfg *config.Config, userService service.UserService) *UserHandler {
	return &UserHandler{cfg: cfg, userService: userService}
}

type editProfileReq struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Bio       string `json:"bio"`
	IsPrivate bool   `json:"is_private"`
}

func (h *UserHandler) GetProfile(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return utils.SendError(c, "Username parameter is required", fiber.StatusBadRequest)
	}

	// Retrieve optional viewer ID for personal follow state flags
	viewerID := getOptionalViewerID(c, h.cfg.JWTSecret)

	profile, err := h.userService.GetProfile(username, viewerID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Profile retrieved successfully", profile, fiber.StatusOK)
}

func (h *UserHandler) EditProfile(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	var req editProfileReq
	if err := c.BodyParser(&req); err != nil {
		return utils.SendError(c, "Invalid request body", fiber.StatusBadRequest)
	}

	// Validations
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Bio = strings.TrimSpace(req.Bio)

	if req.Username == "" || req.Email == "" {
		return utils.SendError(c, "Username and email are required", fiber.StatusBadRequest)
	}

	if !emailRegex.MatchString(req.Email) {
		return utils.SendError(c, "Invalid email format", fiber.StatusBadRequest)
	}

	user, err := h.userService.EditProfile(userID, req.Username, req.Email, req.Bio, req.IsPrivate)
	if err != nil {
		if errors.Is(err, service.ErrUsernameTaken) {
			return utils.SendError(c, err.Error(), fiber.StatusConflict)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Profile updated successfully", fiber.Map{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"bio":        user.Bio,
		"is_private": user.IsPrivate,
	}, fiber.StatusOK)
}

func (h *UserHandler) UploadAvatar(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	fileHeader, err := c.FormFile("avatar")
	if err != nil {
		return utils.SendError(c, "Avatar image file is required in multipart form-data under key 'avatar'", fiber.StatusBadRequest)
	}

	// Validate and save avatar
	maxBytes := h.cfg.MaxAvatarSizeMB * 1024 * 1024
	webPath, _, err := utils.ValidateAndSaveUploadedFile(fileHeader, "uploads/avatars", maxBytes, true)
	if err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	// Save avatar link in DB
	user, err := h.userService.UpdateAvatar(userID, webPath)
	if err != nil {
		return utils.SendError(c, "Failed to update profile picture in database", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Avatar uploaded successfully", fiber.Map{
		"avatar_url": user.Avatar,
	}, fiber.StatusOK)
}

func (h *UserHandler) Follow(c *fiber.Ctx) error {
	followerID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	targetIDStr := c.Params("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid target user ID", fiber.StatusBadRequest)
	}

	if err := h.userService.Follow(followerID, targetID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusBadRequest)
	}

	return utils.SendSuccess(c, "User followed successfully", nil, fiber.StatusOK)
}

func (h *UserHandler) Unfollow(c *fiber.Ctx) error {
	followerID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	targetIDStr := c.Params("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid target user ID", fiber.StatusBadRequest)
	}

	if err := h.userService.Unfollow(followerID, targetID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "User unfollowed successfully", nil, fiber.StatusOK)
}

func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	profile, err := h.userService.GetProfileByID(userID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return utils.SendError(c, err.Error(), fiber.StatusNotFound)
		}
		return utils.SendError(c, "Internal server error", fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Current user retrieved successfully", profile, fiber.StatusOK)
}

func (h *UserHandler) GetFollowRequests(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	requests, err := h.userService.GetPendingFollowRequests(userID)
	if err != nil {
		return utils.SendError(c, "Failed to retrieve follow requests", fiber.StatusInternalServerError)
	}

	type RequestDetail struct {
		ID        uuid.UUID `json:"id"`
		UserID    uuid.UUID `json:"user_id"`
		Username  string    `json:"username"`
		Avatar    *string   `json:"avatar"`
		CreatedAt string    `json:"created_at"`
	}
	
	details := make([]RequestDetail, 0, len(requests))
	for _, req := range requests {
		if req.Follower != nil {
			details = append(details, RequestDetail{
				ID:        req.ID,
				UserID:    req.FollowerID,
				Username:  req.Follower.Username,
				Avatar:    req.Follower.Avatar,
				CreatedAt: req.CreatedAt.Format("2006-01-02T15:04:05Z"),
			})
		}
	}

	return utils.SendSuccess(c, "Follow requests retrieved successfully", details, fiber.StatusOK)
}

func (h *UserHandler) AcceptFollowRequest(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	followerIDStr := c.Params("followerID")
	followerID, err := uuid.Parse(followerIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid follower ID", fiber.StatusBadRequest)
	}

	if err := h.userService.AcceptFollowRequest(followerID, userID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Follow request accepted", nil, fiber.StatusOK)
}

func (h *UserHandler) DeclineFollowRequest(c *fiber.Ctx) error {
	userID, err := getAuthenticatedUserID(c)
	if err != nil {
		return utils.SendError(c, "Unauthorized", fiber.StatusUnauthorized)
	}

	followerIDStr := c.Params("followerID")
	followerID, err := uuid.Parse(followerIDStr)
	if err != nil {
		return utils.SendError(c, "Invalid follower ID", fiber.StatusBadRequest)
	}

	if err := h.userService.DeclineFollowRequest(followerID, userID); err != nil {
		return utils.SendError(c, err.Error(), fiber.StatusInternalServerError)
	}

	return utils.SendSuccess(c, "Follow request declined", nil, fiber.StatusOK)
}

// Helpers
func getAuthenticatedUserID(c *fiber.Ctx) (uuid.UUID, error) {
	userIDVal := c.Locals("userId")
	if userIDVal == nil {
		return uuid.Nil, errors.New("unauthorized context")
	}
	userIDStr, ok := userIDVal.(string)
	if !ok {
		return uuid.Nil, errors.New("invalid user context")
	}
	return uuid.Parse(userIDStr)
}

func getOptionalViewerID(c *fiber.Ctx, jwtSecret string) uuid.UUID {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return uuid.Nil
	}
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return uuid.Nil
	}
	claims, err := utils.ValidateAccessToken(parts[1], jwtSecret)
	if err != nil {
		return uuid.Nil
	}
	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil
	}
	parsed, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}
