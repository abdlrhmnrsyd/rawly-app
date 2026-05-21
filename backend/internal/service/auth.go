package service

import (
	"errors"
	"time"

	"github.com/rawly-app/backend/internal/config"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
	"github.com/rawly-app/backend/internal/utils"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUsernameTaken = errors.New("username is already taken")
	ErrEmailTaken    = errors.New("email is already registered")
	ErrInvalidCreds  = errors.New("invalid email or password")
	ErrUserBanned    = errors.New("your account has been banned")
	ErrTokenExpired  = errors.New("refresh token has expired or is invalid")
	ErrUserNotFound  = errors.New("user not found")
)

type AuthService interface {
	Register(username, email, password string) (*model.User, error)
	Login(email, password string) (string, string, *model.User, error)
	Refresh(tokenStr string) (string, string, error)
	Logout(tokenStr string) error
}

type authService struct {
	cfg      *config.Config
	authRepo repository.AuthRepository
	userRepo repository.UserRepository
}

func NewAuthService(cfg *config.Config, authRepo repository.AuthRepository, userRepo repository.UserRepository) AuthService {
	return &authService{
		cfg:      cfg,
		authRepo: authRepo,
		userRepo: userRepo,
	}
}

func (s *authService) Register(username, email, password string) (*model.User, error) {
	// 1. Check if username is already taken
	existingUser, err := s.authRepo.GetUserByUsername(username)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrUsernameTaken
	}

	// 2. Check if email is already taken
	existingEmail, err := s.authRepo.GetUserByEmail(email)
	if err != nil {
		return nil, err
	}
	if existingEmail != nil {
		return nil, ErrEmailTaken
	}

	// 3. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 4. Create model and save
	user := &model.User{
		Username: username,
		Email:    email,
		Password: string(hashedPassword),
		Role:     "user", // Defaults to standard user
		IsBanned: false,
	}

	if err := s.authRepo.CreateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) Login(email, password string) (string, string, *model.User, error) {
	// 1. Fetch user by email
	user, err := s.authRepo.GetUserByEmail(email)
	if err != nil {
		return "", "", nil, err
	}
	if user == nil {
		return "", "", nil, ErrInvalidCreds
	}

	// 2. Check if user is banned
	if user.IsBanned {
		return "", "", nil, ErrUserBanned
	}

	// 3. Validate password hash
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", "", nil, ErrInvalidCreds
	}

	// 4. Generate access token (JWT)
	accessToken, err := utils.GenerateAccessToken(user.ID.String(), user.Role, s.cfg.JWTSecret, s.cfg.JWTAccessExpiryMinutes)
	if err != nil {
		return "", "", nil, err
	}

	// 5. Generate refresh token
	rawRefreshToken, err := utils.GenerateRefreshToken()
	if err != nil {
		return "", "", nil, err
	}

	// 6. Save refresh token in database
	dbRefreshToken := &model.RefreshToken{
		UserID:    user.ID,
		Token:     rawRefreshToken,
		ExpiresAt: time.Now().Add(time.Duration(s.cfg.JWTRefreshExpiryDays) * 24 * time.Hour),
	}
	if err := s.authRepo.CreateRefreshToken(dbRefreshToken); err != nil {
		return "", "", nil, err
	}

	return accessToken, rawRefreshToken, user, nil
}

func (s *authService) Refresh(tokenStr string) (string, string, error) {
	// 1. Lookup token in DB
	refreshToken, err := s.authRepo.GetRefreshToken(tokenStr)
	if err != nil {
		return "", "", err
	}
	if refreshToken == nil {
		return "", "", ErrTokenExpired
	}

	// 2. Fetch User associated with the token to check status
	user, err := s.userRepo.GetUserByID(refreshToken.UserID)
	if err != nil {
		return "", "", err
	}
	if user == nil {
		return "", "", ErrUserNotFound
	}

	// 3. Check if user is banned
	if user.IsBanned {
		return "", "", ErrUserBanned
	}

	// 4. Generate new tokens
	newAccessToken, err := utils.GenerateAccessToken(user.ID.String(), user.Role, s.cfg.JWTSecret, s.cfg.JWTAccessExpiryMinutes)
	if err != nil {
		return "", "", err
	}

	newRawRefreshToken, err := utils.GenerateRefreshToken()
	if err != nil {
		return "", "", err
	}

	// 5. Rotate refresh token (delete old and insert new)
	if err := s.authRepo.DeleteRefreshToken(tokenStr); err != nil {
		return "", "", err
	}

	newDbRefreshToken := &model.RefreshToken{
		UserID:    user.ID,
		Token:     newRawRefreshToken,
		ExpiresAt: time.Now().Add(time.Duration(s.cfg.JWTRefreshExpiryDays) * 24 * time.Hour),
	}
	if err := s.authRepo.CreateRefreshToken(newDbRefreshToken); err != nil {
		return "", "", err
	}

	return newAccessToken, newRawRefreshToken, nil
}

func (s *authService) Logout(tokenStr string) error {
	return s.authRepo.DeleteRefreshToken(tokenStr)
}
