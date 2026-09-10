# 接口文档

## 认证
- POST /api/auth/register  注册（student/reviewer）
- POST /api/auth/login     登录，返回 JWT token
- GET  /api/me             当前用户

## 学生
- GET  /api/student/projects           我的立项申请列表
- POST /api/student/projects           创建申请
- PUT  /api/student/projects/:id       编辑草稿
- POST /api/student/projects/:id/submit 提交申请
- GET  /api/student/projects/:id/result 查看评审结果

## 评委
- GET  /api/reviewer/assigned          待评审项目
- GET  /api/reviewer/projects/:id      项目详情
- POST /api/reviewer/reviews/:projectId 提交评审
- GET  /api/reviewer/reviews           我完成的评审

## 管理员
- GET  /api/admin/users                用户列表
- GET  /api/admin/projects             项目列表
- GET  /api/admin/projects/:id         项目详情
- POST /api/admin/projects/:id/assign  分配评委
- GET  /api/admin/progress             评审进度
- GET  /api/admin/results              评审结果

鉴权：请求头 `Authorization: Bearer <token>`
