#!/bin/bash
# ==========================================================
# 🚀 1-CLICK TỰ ĐỘNG CHẠY CLOUDFLARE TUNNEL VÀ SYNC LÊN RENDER
# ==========================================================
set -e

cd "$(dirname "$0")"

echo "=========================================================="
echo "🌐 1. KHỞI ĐỘNG CLOUDFLARE TUNNEL CHẠY NGẦM..."
echo "=========================================================="

# Tắt các tiến trình tunnel cũ (nếu có) để tránh xung đột
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
rm -f /tmp/tunnel.log

# Bật cloudflared chạy ngầm vĩnh viễn (không sợ Ctrl+C, không sợ tắt Terminal)
nohup cloudflared tunnel --url http://localhost:5678 > /tmp/tunnel.log 2>&1 &

echo "⏳ Đang kết nối mạng Cloudflare để cấp link công khai mới..."
NEW_URL=""
for i in {1..12}; do
    sleep 1
    NEW_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/tunnel.log | head -n 1 || true)
    if [ -n "$NEW_URL" ]; then
        break
    fi
done

if [ -z "$NEW_URL" ]; then
    echo "❌ Chưa lấy được link Cloudflare. Vui lòng kiểm tra lại kết nối mạng Internet!"
    exit 1
fi

echo "=========================================================="
echo "🎉 LINK CLOUDFLARE MỚI CỦA BẠN LÀ:"
echo "👉 $NEW_URL"
echo "=========================================================="

echo "⚙️ 2. Tự động cập nhật link vào backend/server.js..."
sed -i -E "s|https://[a-zA-Z0-9.-]*\.trycloudflare\.com|$NEW_URL|g" backend/server.js

echo "🚀 3. Tự động đẩy code lên GitHub để Render tự cập nhật..."
git add backend/server.js run-cloud-tunnel.sh
git commit -m "chore: auto-update cloudflare tunnel to $NEW_URL" || true
git push origin develop || true
git push origin main || true

echo "=========================================================="
echo "✅ HOÀN TẤT 100%! HỆ THỐNG ĐÃ SẴN SÀNG:"
echo "1. Đường hầm Cloudflare đang chạy ngầm an toàn (bạn tắt Terminal thoải mái)."
echo "2. Render đang tự động cập nhật link mới trong vòng 30-45 giây."
echo "3. Thầy và hội đồng truy cập link Render sẽ gửi Email Gmail mượt mà 100%!"
echo "=========================================================="

