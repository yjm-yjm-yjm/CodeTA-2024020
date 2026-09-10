package model

import "time"

type Role string

const (
	RoleStudent  Role = "student"
	RoleReviewer Role = "reviewer"
	RoleAdmin    Role = "admin"
)

type User struct {
	ID           uint64    `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"size:100;not null;uniqueIndex" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Role         Role      `gorm:"size:20;not null" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

func (User) TableName() string { return "users" }

type Project struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	StudentID   uint64    `gorm:"not null;index" json:"student_id"`
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	TechStack   string    `gorm:"type:text" json:"tech_stack"`
	TeamSize    int       `json:"team_size"`
	Status      string    `gorm:"size:32;not null" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Student     *User     `gorm:"foreignKey:StudentID" json:"student,omitempty"`
}

func (Project) TableName() string { return "projects" }

type ProjectReviewer struct {
	ID         uint64 `gorm:"primaryKey" json:"id"`
	ProjectID  uint64 `gorm:"not null;uniqueIndex:uk_pr" json:"project_id"`
	ReviewerID uint64 `gorm:"not null;uniqueIndex:uk_pr" json:"reviewer_id"`
	Reviewer   *User  `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
}

func (ProjectReviewer) TableName() string { return "project_reviewers" }

type Review struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	ProjectID  uint64    `gorm:"not null;index" json:"project_id"`
	ReviewerID uint64    `gorm:"not null;index" json:"reviewer_id"`
	Innovation int       `json:"innovation"`
	Technology int       `json:"technology"`
	Value      int       `json:"value"`
	Comment    string    `gorm:"type:text" json:"comment"`
	Conclusion string    `gorm:"size:20;not null" json:"conclusion"`
	CreatedAt  time.Time `json:"created_at"`
}

func (Review) TableName() string { return "reviews" }

// 评分权重常量：创新40% + 技术30% + 产品价值30%
const (
	WeightInnovation = 0.4
	WeightTechnology = 0.3
	WeightValue      = 0.3
)

// Score 计算综合评分，每维度满分10分
func (r Review) Score() float64 {
	return float64(r.Innovation)*WeightInnovation +
		float64(r.Technology)*WeightTechnology +
		float64(r.Value)*WeightValue
}
