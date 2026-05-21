package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
)

type SocialService interface {
	LikePost(userID, postID uuid.UUID) error
	UnlikePost(userID, postID uuid.UUID) error
	CommentPost(userID, postID uuid.UUID, content string) (*model.Comment, error)
	GetComments(postID uuid.UUID, limit, offset int) ([]model.Comment, error)
	GetNotifications(userID uuid.UUID, limit, offset int) ([]model.Notification, error)
	ReadNotifications(userID uuid.UUID) error
}

type socialService struct {
	socialRepo repository.SocialRepository
	postRepo   repository.PostRepository
}

func NewSocialService(socialRepo repository.SocialRepository, postRepo repository.PostRepository) SocialService {
	return &socialService{
		socialRepo: socialRepo,
		postRepo:   postRepo,
	}
}

func (s *socialService) LikePost(userID, postID uuid.UUID) error {
	// 1. Check if post exists
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return err
	}
	if post == nil {
		return ErrPostNotFound
	}

	// 2. Perform DB insert
	like := &model.Like{
		UserID: userID,
		PostID: postID,
	}
	if err := s.socialRepo.LikePost(like); err != nil {
		// Ignore duplicates gracefully or return nil since it's already liked
		return nil
	}

	// 3. Dispatch 'like' notification
	notif := &model.Notification{
		UserID:      post.UserID, // Recipient: Post author
		ActorID:     userID,      // Performer
		Type:        "like",
		ReferenceID: postID,      // Reference post
		IsRead:      false,
	}
	return s.socialRepo.CreateNotification(notif)
}

func (s *socialService) UnlikePost(userID, postID uuid.UUID) error {
	return s.socialRepo.UnlikePost(userID, postID)
}

func (s *socialService) CommentPost(userID, postID uuid.UUID, content string) (*model.Comment, error) {
	if content == "" {
		return nil, errors.New("comment content cannot be empty")
	}

	// 1. Check if post exists
	post, err := s.postRepo.GetPostByID(postID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	// 2. Save Comment
	comment := &model.Comment{
		UserID:  userID,
		PostID:  postID,
		Content: content,
	}
	if err := s.socialRepo.AddComment(comment); err != nil {
		return nil, err
	}

	// 3. Dispatch 'comment' notification
	notif := &model.Notification{
		UserID:      post.UserID, // Recipient: Post author
		ActorID:     userID,      // Performer
		Type:        "comment",
		ReferenceID: comment.ID,  // Reference: Comment ID
		IsRead:      false,
	}
	if err := s.socialRepo.CreateNotification(notif); err != nil {
		// Log error but do not fail comment creation
		// (optional logger logging can go here)
	}

	return comment, nil
}

func (s *socialService) GetComments(postID uuid.UUID, limit, offset int) ([]model.Comment, error) {
	return s.socialRepo.GetCommentsByPostID(postID, limit, offset)
}

func (s *socialService) GetNotifications(userID uuid.UUID, limit, offset int) ([]model.Notification, error) {
	return s.socialRepo.GetNotificationsByUserID(userID, limit, offset)
}

func (s *socialService) ReadNotifications(userID uuid.UUID) error {
	return s.socialRepo.MarkNotificationsAsRead(userID)
}
