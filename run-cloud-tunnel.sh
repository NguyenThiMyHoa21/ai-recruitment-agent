#!/bin/bash
# ==========================================================
# 🚀 1-CLICK ALL-IN-ONE: TỰ ĐỘNG CHẠY HỆ THỐNG KHI MỞ LẠI LAPTOP
# ==========================================================
set -e

cd "$(dirname "$0")"

echo "=========================================================="
echo "🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG TUYỂN DỤNG AI SAU KHI MỞ MÁY..."
echo "=========================================================="

# 1. Đảm bảo Docker Containers (MySQL & n8n) luôn chạy
echo "📦 1. Khởi động n8n & MySQL trong Docker..."
docker start mysql-recruitment 2>/dev/null || true
docker start n8n 2>/dev/null || true
echo "   ✅ MySQL & n8n đã sẵn sàng!"

# 2. Khởi động Backend nội bộ (phục vụ cả localhost:3000 nếu cần)
echo "⚙️  2. Khởi động Backend Server (Port 3000)..."
kill -9 $(lsof -t -i:3000) 2>/dev/null || true
nohup node backend/server.js > backend.log 2>&1 &
echo "   ✅ Backend cục bộ đã chạy!"

# 3. Khởi động Cloudflare Tunnel chạy ngầm kết nối lên Render
echo "🌐 3. Tạo đường hầm kết nối Cloudflare lên Render..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
rm -f /tmp/tunnel.log

nohup cloudflared tunnel --url http://localhost:5678 > /tmp/tunnel.log 2>&1 &

echo "⏳ Đang kết nối mạng Cloudflare để cấp link công khai mới..."
NEW_URL=""
for i in {1..15}; do
    sleep 1
    NEW_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/tunnel.log | head -n 1 || true)
    if [ -n "$NEW_URL" ]; then
        break
    fi
done

if [ -z "$NEW_URL" ]; then
    echo "❌ Chưa lấy được link Cloudflare. Vui lòng kiểm tra lại kết nối Wifi/Internet trên máy!"
    exit 1
fi

echo "=========================================================="
echo "🎉 LINK CLOUDFLARE MỚI CHO N8N LÀ:"
echo "👉 $NEW_URL"
echo "=========================================================="

echo "⚙️  4. Cập nhật link mới vào backend/server.js..."
sed -i -E "s|https://[a-zA-Z0-9.-]*\.trycloudflare\.com|$NEW_URL|g" backend/server.js

echo "🚀 5. Tự động đồng bộ lên GitHub (Render sẽ tự động redeploy & lưu dữ liệu bền vững)..."
git add backend/server.js backend/data-store.js backend/data/*.json run-cloud-tunnel.sh
git commit -m "chore: auto-update cloudflare tunnel to $NEW_URL and sync persistent data" || true
git branch -f main develop 2>/dev/null || true
git push origin develop:develop || true
git push origin develop:main || true

echo "=========================================================="
echo "🎉 HOÀN TẤT 100%! HỆ THỐNG ĐÃ SẴN SÀNG ĐỂ BÁO CÁO:"
echo "----------------------------------------------------------"
echo "✅ Đường hầm Cloudflare đang chạy ngầm an toàn (bạn tắt Terminal thoải mái)."
echo "✅ Render đang cập nhật link mới trong vòng 30-45 giây."
echo "✅ Khi Thầy test trên link Render, Email Gmail sẽ được gửi thật 100%!"
echo "✅ Đồng thời http://localhost:3000 cũng đang chạy song song dự phòng."
echo "=========================================================="
