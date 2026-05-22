package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
)

var (
	ErrPostNotFound     = errors.New("post not found")
	ErrUnauthorizedPost = errors.New("unauthorized: you do not own this post")
)

type PostResponse struct {
	ID            uuid.UUID         `json:"id"`
	Caption       string            `json:"caption"`
	MediaURL      string            `json:"media_url"`
	MediaType     string            `json:"media_type"` // 'image', 'video'
	Media         []model.PostMedia `json:"media,omitempty"`
	Visibility    string            `json:"visibility"`
	AlbumID       *uuid.UUID        `json:"album_id,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UserID        uuid.UUID         `json:"user_id"`
	Username      string            `json:"username"`
	Avatar        *string           `json:"avatar"`
	LikesCount    int64             `json:"likes_count"`
	CommentsCount int64             `json:"comments_count"`
	LikedByMe     bool              `json:"liked_by_me"`
}

type PostService interface {
	CreatePost(userID uuid.UUID, caption string, mediaFiles []model.PostMedia, visibility string, albumID *uuid.UUID) (*model.Post, error)
	DeletePost(userID uuid.UUID, role string, postID uuid.UUID) error
	GetPost(postID uuid.UUID, viewerID uuid.UUID) (*PostResponse, error)
	GetFeed(viewerID uuid.UUID, limit, offset int) ([]PostResponse, error)
	GetUserPosts(targetUsername string, viewerID uuid.UUID, limit, offset int) ([]PostResponse, error)
}

type postService struct {
	postRepo repository.PostRepository
	userRepo repository.UserRepository
}

func NewPostService(postRepo repository.PostRepository, userRepo repository.UserRepository) PostService {
	return &postService{
		postRepo: postRepo,
		userRepo: userRepo,
	}
}

func (s *postService) CreatePost(userID uuid.UUID, caption string, mediaFiles []model.PostMedia, visibility string, albumID *uuid.UUID) (*model.Post, error) {
	if len(mediaFiles) == 0 {
		return nil, errors.New("at least one media file is required")
	}
	if visibility == "" {
		visibility = "public"
	}

	var firstPost *model.Post

	for i, mediaFile := range mediaFiles {
		// Each post gets its own post_media array containing only its specific media
		singleMedia := []model.PostMedia{
			{
				MediaURL:  mediaFile.MediaURL,
				MediaType: mediaFile.MediaType,
			},
		}

		post := &model.Post{
			UserID:     userID,
			Caption:    caption,
			MediaURL:   mediaFile.MediaURL,
			MediaType:  mediaFile.MediaType,
			Media:      singleMedia,
			Visibility: visibility,
			AlbumID:    albumID,
		}

		if err := s.postRepo.CreatePost(post); err != nil {
			return nil, err
		}

		if i == 0 {
			firstPost = post
		}
	}

	return firstPost, nil
}

func (s *postService) DeletePost(userID uuid.UUID, role string, postID uuid.UUID) error {
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if post == nil {
		return ErrPostNotFound
	}

	// Allowed if owner OR if admin role
	if post.UserID != userID && role != "admin" {
		return ErrUnauthorizedPost
	}

	return s.postRepo.DeletePost(postID)
}

func (s *postService) GetPost(postID uuid.UUID, viewerID uuid.UUID) (*PostResponse, error) {
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	likesCount, commentsCount, err := s.postRepo.GetPostStats(post.ID)
	if err != nil {
		return nil, err
	}

	likedByMe := false
	if viewerID != uuid.Nil {
		likedByMe, err = s.postRepo.IsPostLikedByUser(viewerID, post.ID)
		if err != nil {
			return nil, err
		}
	}

	return &PostResponse{
		ID:            post.ID,
		Caption:       post.Caption,
		MediaURL:      post.MediaURL,
		MediaType:     post.MediaType,
		Media:         post.Media,
		Visibility:    post.Visibility,
		AlbumID:       post.AlbumID,
		CreatedAt:     post.CreatedAt,
		UserID:        post.UserID,
		Username:      post.User.Username,
		Avatar:        post.User.Avatar,
		LikesCount:    likesCount,
		CommentsCount: commentsCount,
		LikedByMe:     likedByMe,
	}, nil
}

func (s *postService) GetFeed(viewerID uuid.UUID, limit, offset int) ([]PostResponse, error) {
	posts, err := s.postRepo.GetGlobalFeed(viewerID, limit, offset)
	if err != nil {
		return nil, err
	}

	return s.enrichPosts(posts, viewerID)
}

func (s *postService) GetUserPosts(targetUsername string, viewerID uuid.UUID, limit, offset int) ([]PostResponse, error) {
	user, err := s.userRepo.GetUserByUsername(targetUsername)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	posts, err := s.postRepo.GetPostsByUserID(user.ID, viewerID, limit, offset)
	if err != nil {
		return nil, err
	}

	return s.enrichPosts(posts, viewerID)
}

// helper function to populate liked state, media files, and stats
func (s *postService) enrichPosts(posts []model.Post, viewerID uuid.UUID) ([]PostResponse, error) {
	responses := make([]PostResponse, 0, len(posts))

	for _, post := range posts {
		likesCount, commentsCount, err := s.postRepo.GetPostStats(post.ID)
		if err != nil {
			return nil, err
		}

		likedByMe := false
		if viewerID != uuid.Nil {
			likedByMe, err = s.postRepo.IsPostLikedByUser(viewerID, post.ID)
			if err != nil {
				return nil, err
			}
		}

		responses = append(responses, PostResponse{
			ID:            post.ID,
			Caption:       post.Caption,
			MediaURL:      post.MediaURL,
			MediaType:     post.MediaType,
			Media:         post.Media,
			Visibility:    post.Visibility,
			AlbumID:       post.AlbumID,
			CreatedAt:     post.CreatedAt,
			UserID:        post.UserID,
			Username:      post.User.Username,
			Avatar:        post.User.Avatar,
			LikesCount:    likesCount,
			CommentsCount: commentsCount,
			LikedByMe:     likedByMe,
		})
	}

	return responses, nil
}
