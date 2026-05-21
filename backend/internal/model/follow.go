package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Follow struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	FollowerID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_follower_following" json:"follower_id"`
	FollowingID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_follower_following" json:"following_id"`
	CreatedAt   time.Time `json:"created_at"`

	// Relationships
	Follower  *User `gorm:"foreignKey:FollowerID" json:"-"`
	Following *User `gorm:"foreignKey:FollowingID" json:"-"`
}

// BeforeCreate hook to generate UUID before insertion
func (f *Follow) BeforeCreate(tx *gorm.DB) (err error) {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return
}
