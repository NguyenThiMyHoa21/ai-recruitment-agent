const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function seed() {
    console.log("🚀 Bắt đầu nạp 50 ứng viên mẫu vào CSDL MySQL (recruitment_db)...");
    
    let connection;
    try {
        const socketExists = fs.existsSync("/tmp/mysql.sock");
        connection = await mysql.createConnection(
            socketExists
                ? { socketPath: "/tmp/mysql.sock", user: "recruitment", password: "recruitment123", database: "recruitment_db", multipleStatements: true }
                : { host: "127.0.0.1", port: 3306, user: "recruitment", password: "recruitment123", database: "recruitment_db", multipleStatements: true }
        );

        const sqlPath = path.join(__dirname, "../seed_50_candidates.sql");
        const sqlContent = fs.readFileSync(sqlPath, "utf-8");

        console.log("📄 Đang thực thi seed_50_candidates.sql...");
        await connection.query(sqlContent);

        const [rows] = await connection.query("SELECT COUNT(*) as total, SUM(status='Phỏng vấn') as pv, SUM(status='Đạt') as dat, SUM(status='Loại') as loai FROM candidates");
        const stats = rows[0];

        console.log("\n========================================================");
        console.log("🎉 NẠP THÀNH CÔNG 50 ỨNG VIÊN VÀO CSDL!");
        console.log(`📊 Tổng số hồ sơ:      ${stats.total} ứng viên`);
        console.log(`📅 Đã xếp lịch PV:     ${stats.pv} ứng viên (Luồng 4, 6)`);
        console.log(`✅ Đạt vòng loại:      ${stats.dat} ứng viên (Sẵn sàng test Luồng 4)`);
        console.log(`❌ Loại (Từ chối):     ${stats.loai} ứng viên (Sẵn sàng test Luồng 5)`);
        console.log("========================================================\n");
        console.log("👉 Bạn có thể làm mới (F5) các trang giao diện (Port 5500) để thấy dữ liệu mới nhất!");
    } catch (err) {
        console.error("❌ Lỗi khi nạp dữ liệu:", err.message);
        console.error("💡 Hãy chắc chắn bạn đã chạy: sudo service mysql start");
    } finally {
        if (connection) await connection.end();
    }
}

seed();

