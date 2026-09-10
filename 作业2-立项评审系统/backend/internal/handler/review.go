package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"hackathon-project-review/internal/database"
	"hackathon-project-review/internal/model"
)

type ReviewHandler struct{}

func NewReviewHandler() *ReviewHandler { return &ReviewHandler{} }

// AssignedList 评委查看分配给自己的申请
func (h *ReviewHandler) AssignedList(c *gin.Context) {
	u := currentUser(c)
	var prs []model.ProjectReviewer
	database.DB.Preload("Reviewer").Where("reviewer_id = ?", u.ID).Find(&prs)
	ids := make([]uint64, 0, len(prs))
	for _, pr := range prs {
		ids = append(ids, pr.ProjectID)
	}
	var projects []model.Project
	if len(ids) > 0 {
		database.DB.Preload("Student").Where("id IN ?", ids).Find(&projects)
	}
	c.JSON(http.StatusOK, projects)
}

func (h *ReviewHandler) ProjectDetail(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var p model.Project
	if err := database.DB.Preload("Student").First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "项目不存在"})
		return
	}
	c.JSON(http.StatusOK, p)
}

type reviewReq struct {
	Innovation int    `json:"innovation" binding:"required,gte=0,lte=10"`
	Technology int    `json:"technology" binding:"required,gte=0,lte=10"`
	Value      int    `json:"value" binding:"required,gte=0,lte=10"`
	Comment    string `json:"comment" binding:"required"`
	Conclusion string `json:"conclusion" binding:"required,oneof=pass fail revise"`
}

func (h *ReviewHandler) Submit(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Param("projectId"), 10, 64)
	u := currentUser(c)
	var req reviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	// 校验是否被分配
	var pr model.ProjectReviewer
	if err := database.DB.Where("project_id = ? AND reviewer_id = ?", projectID, u.ID).First(&pr).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "未分配该项目"})
		return
	}
	// 是否已评过
	var count int64
	database.DB.Model(&model.Review{}).Where("project_id = ? AND reviewer_id = ?", projectID, u.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "已评审"})
		return
	}
	r := model.Review{
		ProjectID: projectID, ReviewerID: u.ID, Innovation: req.Innovation,
		Technology: req.Technology, Value: req.Value, Comment: req.Comment, Conclusion: req.Conclusion,
	}
	database.DB.Create(&r)
	// 更新项目状态
	var p model.Project
	database.DB.First(&p, projectID)
	var done, total int64
	database.DB.Model(&model.ProjectReviewer{}).Where("project_id = ?", projectID).Count(&total)
	database.DB.Model(&model.Review{}).Where("project_id = ?", projectID).Count(&done)
	if done >= total {
		database.DB.Model(&p).Update("status", "reviewed")
	}
	c.JSON(http.StatusCreated, gin.H{"id": r.ID, "score": r.Score()})
}

func (h *ReviewHandler) MyReviews(c *gin.Context) {
	u := currentUser(c)
	var reviews []model.Review
	database.DB.Preload("Reviewer").Where("reviewer_id = ?", u.ID).Find(&reviews)
	c.JSON(http.StatusOK, reviews)
}
