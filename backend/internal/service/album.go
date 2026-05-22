package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rawly-app/backend/internal/model"
	"github.com/rawly-app/backend/internal/repository"
)

var (
	ErrAlbumNotFound     = errors.New("album not found")
	ErrUnauthorizedAlbum = errors.New("unauthorized access to album")
)

type AlbumService interface {
	CreateAlbum(userID uuid.UUID, title, description, visibility string) (*model.Album, error)
	GetAlbumByID(albumID uuid.UUID) (*model.Album, error)
	GetAlbumsByUserID(userID, viewerID uuid.UUID) ([]model.Album, error)
	UpdateAlbum(userID, albumID uuid.UUID, title, description, visibility string) (*model.Album, error)
	DeleteAlbum(userID, albumID uuid.UUID) error
	GetAlbumPosts(albumID, viewerID uuid.UUID) ([]model.Post, error)
}

type albumService struct {
	albumRepo repository.AlbumRepository
	userRepo  repository.UserRepository
}

func NewAlbumService(albumRepo repository.AlbumRepository, userRepo repository.UserRepository) AlbumService {
	return &albumService{albumRepo: albumRepo, userRepo: userRepo}
}

func (s *albumService) CreateAlbum(userID uuid.UUID, title, description, visibility string) (*model.Album, error) {
	if title == "" {
		return nil, errors.New("album title is required")
	}
	if visibility == "" {
		visibility = "public"
	}

	album := &model.Album{
		UserID:      userID,
		Title:       title,
		Description: description,
		Visibility:  visibility,
	}

	if err := s.albumRepo.CreateAlbum(album); err != nil {
		return nil, err
	}
	return album, nil
}

func (s *albumService) GetAlbumByID(albumID uuid.UUID) (*model.Album, error) {
	album, err := s.albumRepo.GetAlbumByID(albumID)
	if err != nil {
		return nil, err
	}
	if album == nil {
		return nil, ErrAlbumNotFound
	}
	return album, nil
}

func (s *albumService) GetAlbumsByUserID(userID, viewerID uuid.UUID) ([]model.Album, error) {
	isOwnerOrFollower := false
	if viewerID == userID {
		isOwnerOrFollower = true
	} else if viewerID != uuid.Nil {
		isFollowing, err := s.userRepo.IsFollowing(viewerID, userID)
		if err == nil && isFollowing {
			isOwnerOrFollower = true
		}
	}

	return s.albumRepo.GetAlbumsByUserID(userID, isOwnerOrFollower)
}

func (s *albumService) UpdateAlbum(userID, albumID uuid.UUID, title, description, visibility string) (*model.Album, error) {
	album, err := s.albumRepo.GetAlbumByID(albumID)
	if err != nil {
		return nil, err
	}
	if album == nil {
		return nil, ErrAlbumNotFound
	}

	if album.UserID != userID {
		return nil, ErrUnauthorizedAlbum
	}

	if title != "" {
		album.Title = title
	}
	album.Description = description
	if visibility != "" {
		album.Visibility = visibility
	}

	if err := s.albumRepo.UpdateAlbum(album); err != nil {
		return nil, err
	}
	return album, nil
}

func (s *albumService) DeleteAlbum(userID, albumID uuid.UUID) error {
	album, err := s.albumRepo.GetAlbumByID(albumID)
	if err != nil {
		return err
	}
	if album == nil {
		return ErrAlbumNotFound
	}

	if album.UserID != userID {
		return ErrUnauthorizedAlbum
	}

	return s.albumRepo.DeleteAlbum(albumID)
}

func (s *albumService) GetAlbumPosts(albumID, viewerID uuid.UUID) ([]model.Post, error) {
	album, err := s.albumRepo.GetAlbumByID(albumID)
	if err != nil {
		return nil, err
	}
	if album == nil {
		return nil, ErrAlbumNotFound
	}

	isOwnerOrFollower := false
	if viewerID == album.UserID {
		isOwnerOrFollower = true
	} else if viewerID != uuid.Nil {
		isFollowing, err := s.userRepo.IsFollowing(viewerID, album.UserID)
		if err == nil && isFollowing {
			isOwnerOrFollower = true
		}
	}

	if album.Visibility == "followers" && !isOwnerOrFollower {
		return nil, ErrUnauthorizedAlbum
	}

	return s.albumRepo.GetAlbumPosts(albumID, viewerID, isOwnerOrFollower)
}
