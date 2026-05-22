package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
)

var (
	// ErrUserNotFound and ErrUsernameTaken are already defined in auth.go
)

type ProfileResponse struct {
	ID             uuid.UUID `json:"id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	Avatar         *string   `json:"avatar"`
	Bio            *string   `json:"bio"`
	FollowersCount int64     `json:"followers_count"`
	FollowingCount int64     `json:"following_count"`
	PostsCount     int64     `json:"posts_count"`
	IsFollowing    bool      `json:"is_following"` // Deprecated but kept for compatibility
	FollowStatus   string    `json:"follow_status"` // 'none', 'pending', 'accepted'
	IsPrivate      bool      `json:"is_private"`
	IsBanned       bool      `json:"is_banned"`
}

type UserService interface {
	GetProfile(username string, viewerID uuid.UUID) (*ProfileResponse, error)
	GetProfileByID(userID uuid.UUID) (*ProfileResponse, error)
	EditProfile(userID uuid.UUID, username, email, bio string, isPrivate bool) (*model.User, error)
	UpdateAvatar(userID uuid.UUID, avatarPath string) (*model.User, error)
	Follow(followerID, followingID uuid.UUID) error
	Unfollow(followerID, followingID uuid.UUID) error
	GetPendingFollowRequests(userID uuid.UUID) ([]model.Follow, error)
	AcceptFollowRequest(followerID, followingID uuid.UUID) error
	DeclineFollowRequest(followerID, followingID uuid.UUID) error
}

type userService struct {
	userRepo   repository.UserRepository
	socialRepo repository.SocialRepository
}

func NewUserService(userRepo repository.UserRepository, socialRepo repository.SocialRepository) UserService {
	return &userService{
		userRepo:   userRepo,
		socialRepo: socialRepo,
	}
}

func (s *userService) GetProfile(username string, viewerID uuid.UUID) (*ProfileResponse, error) {
	// 1. Fetch user by username
	user, err := s.userRepo.GetUserByUsername(username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	// 2. Fetch stats
	followers, following, posts, err := s.userRepo.GetFollowStats(user.ID)
	if err != nil {
		return nil, err
	}

	// 3. Check follow status
	followStatus := "none"
	isFollowing := false
	if viewerID != uuid.Nil {
		status, err := s.userRepo.GetFollowStatus(viewerID, user.ID)
		if err == nil {
			followStatus = status
			isFollowing = (status == "accepted")
		}
	}

	return &ProfileResponse{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Avatar:         user.Avatar,
		Bio:            user.Bio,
		FollowersCount: followers,
		FollowingCount: following,
		PostsCount:     posts,
		IsFollowing:    isFollowing,
		FollowStatus:   followStatus,
		IsPrivate:      user.IsPrivate,
		IsBanned:       user.IsBanned,
	}, nil
}

func (s *userService) GetProfileByID(userID uuid.UUID) (*ProfileResponse, error) {
	// 1. Fetch user by ID
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	// 2. Fetch stats
	followers, following, posts, err := s.userRepo.GetFollowStats(user.ID)
	if err != nil {
		return nil, err
	}

	return &ProfileResponse{
		ID:             user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Avatar:         user.Avatar,
		Bio:            user.Bio,
		FollowersCount: followers,
		FollowingCount: following,
		PostsCount:     posts,
		IsFollowing:    false,
		FollowStatus:   "none",
		IsPrivate:      user.IsPrivate,
		IsBanned:       user.IsBanned,
	}, nil
}

func (s *userService) EditProfile(userID uuid.UUID, username, email, bio string, isPrivate bool) (*model.User, error) {
	// Fetch user
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	// If changing username, check if taken
	if username != user.Username {
		existing, err := s.userRepo.GetUserByUsername(username)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, ErrUsernameTaken
		}
		user.Username = username
	}

	user.Email = email
	user.Bio = &bio
	user.IsPrivate = isPrivate

	if err := s.userRepo.UpdateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *userService) UpdateAvatar(userID uuid.UUID, avatarPath string) (*model.User, error) {
	user, err := s.userRepo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	user.Avatar = &avatarPath
	if err := s.userRepo.UpdateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *userService) Follow(followerID, followingID uuid.UUID) error {
	if followerID == followingID {
		return errors.New("you cannot follow yourself")
	}

	// 1. Establish follow connection
	err := s.userRepo.FollowUser(followerID, followingID)
	if err != nil {
		return err
	}

	// Fetch target user's privacy status to dispatch notification
	targetUser, err := s.userRepo.GetUserByID(followingID)
	if err != nil {
		return err
	}

	notifType := "follow"
	if targetUser.IsPrivate {
		notifType = "follow_request"
	}

	// 2. Dispatch Notification
	notif := &model.Notification{
		UserID:      followingID, // Recipient
		ActorID:     followerID,  // Performer
		Type:        notifType,
		ReferenceID: followerID,  // Reference to follower
		IsRead:      false,
	}
	return s.socialRepo.CreateNotification(notif)
}

func (s *userService) Unfollow(followerID, followingID uuid.UUID) error {
	return s.userRepo.UnfollowUser(followerID, followingID)
}

func (s *userService) GetPendingFollowRequests(userID uuid.UUID) ([]model.Follow, error) {
	return s.userRepo.GetPendingFollowRequests(userID)
}

func (s *userService) AcceptFollowRequest(followerID, followingID uuid.UUID) error {
	err := s.userRepo.AcceptFollowRequest(followerID, followingID)
	if err != nil {
		return err
	}

	// Send a notification to the follower that they are now following
	notif := &model.Notification{
		UserID:      followerID,  // Recipient (the follower)
		ActorID:     followingID, // Performer (the user who accepted)
		Type:        "follow_accept",
		ReferenceID: followingID,
		IsRead:      false,
	}
	return s.socialRepo.CreateNotification(notif)
}

func (s *userService) DeclineFollowRequest(followerID, followingID uuid.UUID) error {
	return s.userRepo.DeclineFollowRequest(followerID, followingID)
}
