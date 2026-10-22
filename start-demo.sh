#!/bin/bash
# ==========================================================
# 🚀 SCRIPT KHỞI ĐỘNG 1-CLICK: AI RECRUITMENT MULTI-AGENT
# ==========================================================

cd "$(dirname "$0")"

echo "=========================================================="
echo "🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG TUYỂN DỤNG THÔNG MINH AI..."
echo "=========================================================="

# 1. Khởi động Docker containers (MySQL + n8n)
echo "📦 1. Khởi động Docker Containers (MySQL & n8n)..."
docker start mysql-recruitment 2>/dev/null || true
docker start n8n 2>/dev/null || true
echo "   ✅ MySQL & n8n đã hoạt động!"

# 2. Khởi động Backend Server
echo "⚙️  2. Khởi động Backend Server (Port 3000)..."
kill -9 $(lsof -t -i:3000) 2>/dev/null || true
nohup node backend/server.js > backend.log 2>&1 &
sleep 2
echo "   ✅ Backend Server đã chạy tại: http://localhost:3000"

# 3. Tự động mở trình duyệt Cổng ứng viên
echo "🌐 3. Mở Cổng ứng viên trên trình duyệt..."
xdg-open "http://localhost:3000/candidate-portal.html" 2>/dev/null || true

echo "=========================================================="
echo "🎉 HỆ THỐNG ĐÃ SẴN SÀNG ĐỂ VẤN ĐÁP & DEMO TRƯỚC HỘI ĐỒNG!"
echo "----------------------------------------------------------"
echo "👉 Cổng Ứng Viên:        http://localhost:3000/candidate-portal.html"
echo "👉 Sàng Lọc CV (Luồng 2): http://localhost:3000/cv-screening.html"
echo "👉 Xếp Lịch Phỏng Vấn:   http://localhost:3000/interview-management.html"
echo "👉 Báo Cáo Tuyển Dụng:   http://localhost:3000/recruitment-report.html"
echo "👉 Trình Soạn Thảo n8n:  http://localhost:5678"
echo "=========================================================="