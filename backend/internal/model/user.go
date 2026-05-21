package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Username  string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Email     string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Password  string         `gorm:"type:varchar(255);not null" json:"-"`
	Avatar    *string        `gorm:"type:varchar(255)" json:"avatar"`
	Bio       *string        `gorm:"type:text" json:"bio"`
	Role      string         `gorm:"type:varchar(20);default:'user';not null" json:"role"` // 'user', 'admin'
	IsBanned  bool           `gorm:"default:false;not null" json:"is_banned"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Posts         []Post         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Comments      []Comment      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Likes         []Like         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Followers     []Follow       `gorm:"foreignKey:FollowingID;constraint:OnDelete:CASCADE" json:"-"`
	Following     []Follow       `gorm:"foreignKey:FollowerID;constraint:OnDelete:CASCADE" json:"-"`
	Notifications []Notification `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	ReportsSent   []Report       `gorm:"foreignKey:ReporterID;constraint:OnDelete:CASCADE" json:"-"`
}

// BeforeCreate hook to generate UUID before insertion
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
