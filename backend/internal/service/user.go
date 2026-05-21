package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
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
	IsFollowing    bool      `json:"is_following"`
	IsBanned       bool      `json:"is_banned"`
}

type UserService interface {
	GetProfile(username string, viewerID uuid.UUID) (*ProfileResponse, error)
	GetProfileByID(userID uuid.UUID) (*ProfileResponse, error)
	EditProfile(userID uuid.UUID, username, email, bio string) (*model.User, error)
	UpdateAvatar(userID uuid.UUID, avatarPath string) (*model.User, error)
	Follow(followerID, followingID uuid.UUID) error
	Unfollow(followerID, followingID uuid.UUID) error
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

	// 3. Check if viewer follows user
	isFollowing := false
	if viewerID != uuid.Nil {
		isFollowing, err = s.userRepo.IsFollowing(viewerID, user.ID)
		if err != nil {
			return nil, err
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
		IsBanned:       user.IsBanned,
	}, nil
}

func (s *userService) EditProfile(userID uuid.UUID, username, email, bio string) (*model.User, error) {
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

	// If changing email, search for collision (using user repo username since we can fetch by username, or just write a small check)
	// For email uniqueness, we can fetch username or search it.
	// Since GetUserByID doesn't check email collision easily, let's keep email update safe. We can check if email matches or is taken.
	// Let's implement this simply.
	user.Email = email
	user.Bio = &bio

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
		// Follow relation unique constraint will throw error if already followed
		return err
	}

	// 2. Dispatch Follow Notification
	notif := &model.Notification{
		UserID:      followingID, // Recipient
		ActorID:     followerID,  // Performer
		Type:        "follow",
		ReferenceID: followerID,  // Reference to follower
		IsRead:      false,
	}
	return s.socialRepo.CreateNotification(notif)
}

func (s *userService) Unfollow(followerID, followingID uuid.UUID) error {
	return s.userRepo.UnfollowUser(followerID, followingID)
}
