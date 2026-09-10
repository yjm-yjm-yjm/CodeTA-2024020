package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"hackathon-project-review/internal/database"
	"hackathon-project-review/internal/model"
)

type ProjectHandler struct{}

func NewProjectHandler() *ProjectHandler { return &ProjectHandler{} }

type projectReq struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	TechStack   string `json:"tech_stack"`
	TeamSize    int    `json:"team_size"`
}

func currentUser(c *gin.Context) *model.User {
	u, _ := c.Get("user")
	return u.(*model.User)
}

// MyProjects 学生查看自己的立项申请
func (h *ProjectHandler) MyProjects(c *gin.Context) {
	u := currentUser(c)
	var projects []model.Project
	database.DB.Where("student_id = ?", u.ID).Order("created_at desc").Find(&projects)
	c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) Create(c *gin.Context) {
	var req projectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	u := currentUser(c)
	p := model.Project{
		StudentID: u.ID, Title: req.Title, Description: req.Description,
		TechStack: req.TechStack, TeamSize: req.TeamSize, Status: "draft",
	}
	database.DB.Create(&p)
	c.JSON(http.StatusCreated, p)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	u := currentUser(c)
	var p model.Project
	if err := database.DB.Where("id = ? AND student_id = ?", id, u.ID).First(&p).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申请不存在"})
		return
	}
	if p.Status != "draft" {
		c.JSON(http.StatusForbidden, gin.H{"error": "已提交的申请不能修改"})
		return
	}
	var req projectReq
	_ = c.ShouldBindJSON(&req)
	p.Title = req.Title
	p.Description = req.Description
	p.TechStack = req.TechStack
	p.TeamSize = req.TeamSize
	database.DB.Save(&p)
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) Submit(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	u := currentUser(c)
	var p model.Project
	if err := database.DB.Where("id = ? AND student_id = ?", id, u.ID).First(&p).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申请不存在"})
		return
	}
	if p.Status != "draft" {
		c.JSON(http.StatusForbidden, gin.H{"error": "申请已提交"})
		return
	}
	p.Status = "submitted"
	database.DB.Save(&p)
	c.JSON(http.StatusOK, p)
}

func (h *ProjectHandler) Result(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	u := currentUser(c)
	var p model.Project
	if err := database.DB.Where("id = ? AND student_id = ?", id, u.ID).First(&p).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申请不存在"})
		return
	}
	var reviews []model.Review
	database.DB.Where("project_id = ?", p.ID).Find(&reviews)
	type item struct {
		ReviewerID uint64  `json:"reviewer_id"`
		Innovation int     `json:"innovation"`
		Technology int     `json:"technology"`
		Value      int     `json:"value"`
		Comment    string  `json:"comment"`
		Conclusion string  `json:"conclusion"`
		Score      float64 `json:"score"`
	}
	items := make([]item, 0, len(reviews))
	var sum float64
	for _, r := range reviews {
		items = append(items, item{
			ReviewerID: r.ReviewerID, Innovation: r.Innovation, Technology: r.Technology,
			Value: r.Value, Comment: r.Comment, Conclusion: r.Conclusion, Score: r.Score(),
		})
		sum += r.Score()
	}
	var avg float64
	if len(items) > 0 {
		avg = sum / float64(len(items))
	}
	c.JSON(http.StatusOK, gin.H{"status": p.Status, "reviews": items, "avg_score": avg})
}
