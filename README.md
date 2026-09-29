# AI Recruitment Agent

## Mô tả

AI Recruitment Agent là hệ thống tự động hóa quy trình tuyển dụng sử dụng Web, Backend/API, n8n, AI/LLM và Database.

## Thành viên

- Nguyễn Thị Mỹ Hoa
- Lê Thị Yến Nhi

## Công nghệ

- Ubuntu
- Web
- Backend / REST API
- n8n
- Google Gemini
- AI / LLM
- Webhook
- Database
- OCR / PDF
- Git / GitHub

## Workflows

### Nguyễn Thị Mỹ Hoa

#### Workflow 1 - Job Posting Agent
Tạo và xử lý thông tin tuyển dụng bằng AI.

#### Workflow 2 - CV Screening Agent
Đọc, phân tích CV và đánh giá mức độ phù hợp của ứng viên.

#### Workflow 3 - Recruitment Report Agent
Tổng hợp dữ liệu tuyển dụng và tạo báo cáo.

### Lê Thị Yến Nhi

#### Workflow 4 - Interview Scheduling Agent
Tự động hỗ trợ sắp xếp lịch phỏng vấn.

#### Workflow 5 - Interview Notification Agent
Tự động tạo và gửi thông báo lịch phỏng vấn.

#### Workflow 6 - Candidate Management Agent
Quản lý thông tin và trạng thái của ứng viên.

## System Architecture

Web
↓
Backend / REST API
↓
n8n Automation
↓
AI / Gemini
↓
Decision
↓
Action
↓
Database

## Workflow Architecture

Trigger
→ Data Processing
→ API
→ AI
→ Decision
→ Action
→ Human Approval
→ Logging / Monitoring

## Project Structure

ai-recruitment-agent/
│
├── workflows/
│   ├── hoa/
│   │   ├── 01-job-posting.json
│   │   ├── 02-cv-screening.json
│   │   └── 03-recruitment-report.json
│   │
│   └── nhi/
│       ├── 04-interview-scheduling.json
│       ├── 05-interview-notification.json
│       └── 06-candidate-management.json
│
├── backend/
├── web/
└── README.md

## Git Workflow

Mỗi thành viên phát triển các workflow của mình trên branch riêng.

main
├── feature/hoa
└── feature/nhi

Các workflow n8n được export thành file JSON và lưu trong thư mục workflows.


<!-- Verified commit author test -->
