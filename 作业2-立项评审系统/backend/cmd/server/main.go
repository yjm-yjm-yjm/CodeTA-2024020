package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"hackathon-project-review/internal/database"
	"hackathon-project-review/internal/handler"
	"hackathon-project-review/internal/middleware"
)

func main() {
	database.Init()

	r := gin.Default()

	auth := handler.NewAuthHandler()
	r.POST("/api/auth/register", auth.Register)
	r.POST("/api/auth/login", auth.Login)

	authGroup := r.Group("/api", middleware.Auth())
	{
		authGroup.GET("/me", auth.Me)
	}

	student := handler.NewProjectHandler()
	studentGroup := r.Group("/api/student", middleware.Auth(), middleware.RequireRole("student"))
	{
		studentGroup.GET("/projects", student.MyProjects)
		studentGroup.POST("/projects", student.Create)
		studentGroup.PUT("/projects/:id", student.Update)
		studentGroup.POST("/projects/:id/submit", student.Submit)
		studentGroup.GET("/projects/:id/result", student.Result)
	}

	review := handler.NewReviewHandler()
	reviewerGroup := r.Group("/api/reviewer", middleware.Auth(), middleware.RequireRole("reviewer"))
	{
		reviewerGroup.GET("/assigned", review.AssignedList)
		reviewerGroup.GET("/projects/:id", review.ProjectDetail)
		reviewerGroup.POST("/reviews/:projectId", review.Submit)
		reviewerGroup.GET("/reviews", review.MyReviews)
	}

	admin := handler.NewAdminHandler()
	adminGroup := r.Group("/api/admin", middleware.Auth(), middleware.RequireRole("admin"))
	{
		adminGroup.GET("/users", admin.Users)
		adminGroup.GET("/projects", admin.Projects)
		adminGroup.GET("/projects/:id", admin.ProjectDetail)
		adminGroup.POST("/projects/:id/assign", admin.Assign)
		adminGroup.GET("/progress", admin.Progress)
		adminGroup.GET("/results", admin.Results)
	}

	log.Println("server listening on :8080")
	r.Run(":8080")
}
