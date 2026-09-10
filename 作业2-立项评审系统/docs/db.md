# 数据库文档

## users 用户表
- id, email(唯一), password_hash, role(student/reviewer/admin), created_at

## projects 立项申请表
- id, student_id, title, description, tech_stack, team_size, status(draft/submitted/reviewing/reviewed), created_at, updated_at

## project_reviewers 项目-评委分配表
- id, project_id, reviewer_id（联合唯一）

## reviews 评审表
- id, project_id, reviewer_id, innovation(0-10), technology(0-10), value(0-10), comment, conclusion(pass/fail/revise), created_at

总分 = 创新×40% + 技术×30% + 价值×30%
