package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"hackathon-project-review/internal/database"
	"hackathon-project-review/internal/model"
)

type AdminHandler struct{}

func NewAdminHandler() *AdminHandler { return &AdminHandler{} }

func (h *AdminHandler) Users(c *gin.Context) {
	var users []model.User
	database.DB.Order("id asc").Find(&users)
	c.JSON(http.StatusOK, users)
}

func (h *AdminHandler) Projects(c *gin.Context) {
	var projects []model.Project
	database.DB.Preload("Student").Order("created_at desc").Find(&projects)
	c.JSON(http.StatusOK, projects)
}

func (h *AdminHandler) ProjectDetail(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var p model.Project
	if err := database.DB.Preload("Student").First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "项目不存在"})
		return
	}
	var reviewers []model.ProjectReviewer
	database.DB.Preload("Reviewer").Where("project_id = ?", id).Find(&reviewers)
	c.JSON(http.StatusOK, gin.H{"project": p, "reviewers": reviewers})
}

type assignReq struct {
	ReviewerIDs []uint64 `json:"reviewer_ids" binding:"required"`
}

func (h *AdminHandler) Assign(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var req assignReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	var p model.Project
	if err := database.DB.First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "项目不存在"})
		return
	}
	for _, rid := range req.ReviewerIDs {
		var count int64
		database.DB.Model(&model.ProjectReviewer{}).Where("project_id = ? AND reviewer_id = ?", id, rid).Count(&count)
		if count == 0 {
			database.DB.Create(&model.ProjectReviewer{ProjectID: id, ReviewerID: rid})
		}
	}
	database.DB.Model(&p).Update("status", "reviewing")
	c.JSON(http.StatusOK, gin.H{"message": "分配成功"})
}

func (h *AdminHandler) Progress(c *gin.Context) {
	var projects []model.Project
	database.DB.Preload("Student").Order("created_at desc").Find(&projects)
	type item struct {
		Project  model.Project `json:"project"`
		Assigned int64         `json:"assigned"`
		Reviewed int64         `json:"reviewed"`
	}
	items := make([]item, 0, len(projects))
	for _, p := range projects {
		var total, done int64
		database.DB.Model(&model.ProjectReviewer{}).Where("project_id = ?", p.ID).Count(&total)
		database.DB.Model(&model.Review{}).Where("project_id = ?", p.ID).Count(&done)
		items = append(items, item{Project: p, Assigned: total, Reviewed: done})
	}
	c.JSON(http.StatusOK, items)
}

func (h *AdminHandler) Results(c *gin.Context) {
	var projects []model.Project
	database.DB.Preload("Student").Order("created_at desc").Find(&projects)
	type reviewResult struct {
		Project  model.Project `json:"project"`
		AvgScore float64       `json:"avg_score"`
		Count    int           `json:"count"`
	}
	out := make([]reviewResult, 0, len(projects))
	for _, p := range projects {
		var reviews []model.Review
		database.DB.Where("project_id = ?", p.ID).Find(&reviews)
		var sum float64
		for _, r := range reviews {
			sum += r.Score()
		}
		var avg float64
		if len(reviews) > 0 {
			avg = sum / float64(len(reviews))
		}
		out = append(out, reviewResult{Project: p, AvgScore: avg, Count: len(reviews)})
	}
	c.JSON(http.StatusOK, out)
}
