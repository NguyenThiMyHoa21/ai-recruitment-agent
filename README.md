# 🤖 AI Recruitment Multi-Agent System (Hệ Thống Tuyển Dụng Thông Minh Đa Tác Tử)

## 📌 Giới Thiệu Dự Án
Hệ thống **AI Recruitment Multi-Agent System** là giải pháp tự động hóa toàn bộ quy trình tuyển dụng nhân sự end-to-end kết hợp giữa **Giao diện Web, Backend Node.js/REST API, Docker MySQL, n8n Automation Workflows và AI Google Gemini**.

## 👥 Tác Giả & Phân Công Nhiệm Vụ

- **Nguyễn Thị Mỹ Hoa**:
  - **Luồng 1 (Job Posting Agent)**: Đăng tin & Tự động tạo bài đăng tuyển dụng bằng AI Gemini.
  - **Luồng 2 (CV Screening Agent)**: Tự động đọc CV, chấm điểm đối chiếu với JD & phân loại Đạt/Loại.
  - **Luồng 3 (Recruitment Report Agent)**: Dashboard phân tích chỉ số, nhận định AI & **Xuất Báo Cáo Excel (.xlsx)**.

- **Lê Thị Yến Nhi**:
  - **Luồng 4 (Interview Scheduling Agent)**: Tự động xếp lịch phỏng vấn giãn cách thông minh (+45 phút) & Tạo Link Google Meet.
  - **Luồng 5 (Rejection Notification Agent)**: Tự động gửi Email từ chối & thư cảm ơn lịch sự cho nhóm Loại.
  - **Luồng 6 (Candidate Management Agent)**: Quản lý trạng thái phễu tuyển dụng, đổi giờ phỏng vấn linh hoạt & gửi mail cập nhật.

---

## 🛠️ Công Nghệ Sử Dụng
- **Frontend**: HTML5, CSS3 (Bootstrap 5, FontAwesome), JavaScript (ES6+), SheetJS (Excel .xlsx export).
- **Backend**: Node.js, Express.js, MySQL2, CORS.
- **Database**: Docker MySQL (`mysql-recruitment`, Port 3306).
- **Workflow Automation**: Docker n8n (`http://localhost:5678`), Webhook API.
- **AI Integration**: Google Gemini 1.5/2.0 API.
- **Version Control**: Git & GitHub.

---

## 📁 Cấu Trúc Thư Mục Dự Án Clean & Chuẩn

```text
ai-recruitment-agent/
├── backend/                        # Backend Node.js Express API
│   ├── node_modules/               # Thư viện npm
│   ├── package.json                # Cấu hình phụ thuộc backend
│   ├── package-lock.json
│   └── server.js                   # REST API máy chủ (Port 3306 & 3000)
│
├── frontend/                       # Giao diện Web Client (Port 5500)
│   ├── index.html                  # 1. Đăng tin tuyển dụng
│   ├── cv-screening.html           # 2. Sàng lọc CV AI
│   ├── recruitment-report.html     # 3. Báo cáo tuyển dụng & Xuất Excel (.xlsx)
│   ├── interview-management.html   # 4. Quản lý ứng viên & Đổi giờ phỏng vấn
│   ├── script.js                   # Logic xử lý chung
│   └── style.css                   # Custom CSS styling
│
├── workflows/                      # Quy trình tự động hóa n8n JSON
│   ├── workflow-1-job-posting.json
│   ├── workflow-2-cv-screening.json
│   ├── workflow-3-recruitment-report.json
│   ├── workflow-4-interview-scheduling.json
│   ├── workflow-5-candidate-notification.json
│   └── workflow-6-candidate-management.json
│
├── .env                            # Biến môi trường
├── .gitignore                      # File cấu hình Git ignore
└── README.md                       # Tài liệu hướng dẫn dự án
```

---

## 🚀 Hướng Dẫn Khởi Chạy Dự Án

### 1. Khởi chạy Docker Container (MySQL & n8n)
```bash
docker start mysql-recruitment n8n
```

### 2. Khởi chạy Backend Node.js API (Port 3000)
```bash
cd /home/my-hoa-it/ai-recruitment-agent/backend
node server.js
```

### 3. Khởi chạy Frontend Web App (Port 5500)
```bash
cd /home/my-hoa-it/ai-recruitment-agent/frontend
python3 -m http.server 5500
```
Mở trình duyệt truy cập: `http://localhost:5500`

---

## 📜 Bản Quyền
© 2026 **AI Recruitment Multi-Agent System** • Nghiên cứu & Phát triển bởi: **Nguyễn Thị Mỹ Hoa - Lê Thị Yến Nhi**
