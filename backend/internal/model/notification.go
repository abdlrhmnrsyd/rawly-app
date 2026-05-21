package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Notification struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`  // Recipient
	ActorID     uuid.UUID `gorm:"type:uuid;not null;index" json:"actor_id"` // Action performer
	Type        string    `gorm:"type:varchar(20);not null" json:"type"`    // 'like', 'comment', 'follow'
	ReferenceID uuid.UUID `gorm:"type:uuid;not null" json:"reference_id"`   // ID of post, comment, etc.
	IsRead      bool      `gorm:"default:false;not null" json:"is_read"`
	CreatedAt   time.Time `json:"created_at"`

	// Relationships
	User  *User `gorm:"foreignKey:UserID" json:"-"`
	Actor *User `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
}

// BeforeCreate hook to generate UUID before insertion
func (n *Notification) BeforeCreate(tx *gorm.DB) (err error) {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return
}
