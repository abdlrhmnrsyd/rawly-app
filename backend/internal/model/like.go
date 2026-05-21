package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Like struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_post" json:"user_id"`
	PostID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_post" json:"post_id"`
	CreatedAt time.Time `json:"created_at"`

	// Relationships
	User *User `gorm:"foreignKey:UserID" json:"-"`
	Post *Post `gorm:"foreignKey:PostID" json:"-"`
}

// BeforeCreate hook to generate UUID before insertion
func (l *Like) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return
}
