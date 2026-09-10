# 黑客松立项评审系统（简化版）

学生提交项目立项申请，管理员分配评委，评委评分并给出结论，学生查看评审结果。

## 技术栈
- 后端：Go + Gin + GORM + MySQL
- 前端：React + Vite + TypeScript
- 认证：JWT（密钥从环境变量读取）+ bcrypt 密码加密

## 项目结构
- backend/cmd/server：入口
- backend/internal/handler：业务处理（auth / project / review / admin）
- backend/internal/middleware：登录鉴权与角色校验
- backend/internal/model：数据模型（含评分权重常量）
- backend/internal/pkg/jwt：JWT 签发与解析
- frontend/src/pages：三角色页面（student / reviewer / admin）

## 启动
1. 数据库：`docker compose up -d`
2. 后端：`cd backend && export JWT_SECRET=xxx && go run ./cmd/server`
3. 前端：`cd frontend && npm install && npm run dev`

## 测试
`cd backend && go test ./...`

## 内置管理员
- admin@hackathon.com / admin123
