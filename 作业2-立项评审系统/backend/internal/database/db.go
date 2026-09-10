package database

import (
	"log"
	"os"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"hackathon-project-review/internal/model"
)

var DB *gorm.DB

func Init() {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "root:root@tcp(127.0.0.1:3306)/hackathon?charset=utf8mb4&parseTime=True&loc=Local"
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database: ", err)
	}
	db.AutoMigrate(&model.User{}, &model.Project{}, &model.ProjectReviewer{}, &model.Review{})
	DB = db
}
