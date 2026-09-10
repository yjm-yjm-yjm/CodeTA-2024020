package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"hackathon-project-review/internal/database"
	"hackathon-project-review/internal/model"
	"hackathon-project-review/internal/pkg/jwt"
)

// Auth 校验登录态，把当前用户注入上下文
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" || !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		claims, err := jwt.Parse(strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "登录已过期"})
			return
		}
		var user model.User
		if err := database.DB.First(&user, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}

// RequireRole 校验角色
func RequireRole(role model.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, _ := c.Get("user")
		u := user.(*model.User)
		if u.Role != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "无权限"})
			return
		}
		c.Next()
	}
}
