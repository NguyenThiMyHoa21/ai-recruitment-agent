const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "recruitment",
    password: "recruitment123",
    database: "recruitment_db"
});

const app = express();
const PORT = 3000;

const path = require("path");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Kiểm tra backend
app.get("/api/health", (req, res) => {
    res.json({
        message: "AI Recruitment Agent Backend is running!"
    });
});

// API lấy danh sách Job đã published
app.get("/api/jobs", async (req, res) => {
    try {
        const [jobs] = await db.query(`
            SELECT id, position, department, location, salary, requirements
            FROM jobs
            WHERE status = 'published'
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            jobs: jobs
        });

    } catch (error) {
        console.error("Error loading jobs:", error);

        res.status(500).json({
            success: false,
            message: "Cannot load jobs",
            error: error.message
        });
    }
});

// API gửi thông tin tuyển dụng đến n8n
app.post("/api/jobs", async (req, res) => {
    try {
        const jobData = req.body;

        console.log("Recruitment data received:");
        console.log(jobData);

        const response = await fetch(
            "http://localhost:5678/webhook/job-posting",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(jobData)
            }
        );

        const result = await response.text();

        res.json({
            success: true,
            message: "Recruitment data sent to n8n",
            n8nResponse: result
        });

    } catch (error) {
        console.error("Error:", error);

        res.status(500).json({
            success: false,
            message: "Cannot connect to n8n",
            error: error.message
        });
    }
});

// API lấy danh sách ứng viên đã sàng lọc từ MySQL
app.get("/api/candidates", async (req, res) => {
    try {
        const [candidates] = await db.query(`
            SELECT c.id, c.job_id, 
                   COALESCE(c.full_name, c.name) as full_name,
                   c.name, c.email, c.cv_content, c.match_score, 
                   c.approval_status, 
                   COALESCE(c.status, CASE WHEN c.approval_status = 'APPROVED' THEN 'Đạt' ELSE 'Loại' END) as status,
                   c.ai_evaluation, c.interview_time, c.interviewer_name, c.meeting_link, c.created_at,
                   COALESCE(c.applied_position, j.position, CONCAT('Vị trí #', c.job_id)) as position,
                   COALESCE(c.applied_position, j.position, CONCAT('Vị trí #', c.job_id)) as applied_position
            FROM candidates c
            LEFT JOIN jobs j ON c.job_id = j.id
            ORDER BY c.id DESC
            LIMIT 50
        `);

        res.json({
            success: true,
            candidates: candidates,
            data: candidates
        });
    } catch (error) {
        console.error("Error loading candidates:", error);
        res.status(500).json({
            success: false,
            message: "Cannot load candidates",
            error: error.message
        });
    }
});

// Route API xếp lịch phỏng vấn qua Luồng 4 n8n
app.post("/api/schedule-interview", async (req, res) => {
    const { candidate_id, requested_by } = req.body;
    try {
        const response = await fetch("http://localhost:5678/webhook/interview-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(candidate_id),
                requested_by: requested_by || "HR_Web_Admin"
            })
        });
        const result = await response.json();

        // Đồng bộ trạng thái phỏng vấn vào MySQL để Trang 3 & Trang 4 liên thông 100%
        try {
            await db.query(
                "UPDATE candidates SET approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn' WHERE id = ?",
                [Number(candidate_id)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB:", dbErr.message);
        }

        res.json(result);
    } catch (error) {
        console.error("Lỗi gọi Luồng 4 n8n:", error.message);
        res.status(500).json({ success: false, message: "Lỗi khi xếp lịch phỏng vấn qua n8n" });
    }
});

// Route API cập nhật trạng thái ứng viên qua Luồng 6 n8n
app.post("/api/candidates/update-status", async (req, res) => {
    const { id, candidate_id, full_name, applied_position, new_status } = req.body;
    const targetId = candidate_id || id;
    if (!targetId || !new_status) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    try {
        const response = await fetch("http://localhost:5678/webhook/update-candidate-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(targetId),
                full_name,
                applied_position,
                new_status
            })
        });
        const result = await response.json();

        // Đồng bộ cả approval_status và status để Trang 3 và Trang 4 khớp nhau hoàn toàn
        let appStatus = 'APPROVED';
        if (new_status === 'Loại' || new_status === 'Không đạt' || new_status === 'REJECTED') {
            appStatus = 'REJECTED';
        } else if (new_status === 'Phỏng vấn' || new_status === 'INTERVIEW_SCHEDULED') {
            appStatus = 'INTERVIEW_SCHEDULED';
        }

        try {
            await db.query(
                "UPDATE candidates SET approval_status = ?, status = ? WHERE id = ?",
                [appStatus, new_status, Number(targetId)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB:", dbErr.message);
        }

        res.json(result);
    } catch (error) {
        console.error("Lỗi gọi Luồng 6 n8n:", error.message);
        res.status(500).json({ success: false, message: "Lỗi kết nối n8n cập nhật trạng thái" });
    }
});

// API xóa hồ sơ ứng viên
app.delete("/api/candidates/:id", async (req, res) => {
    try {
        const candidateId = req.params.id;
        await db.query("DELETE FROM candidates WHERE id = ?", [candidateId]);
        res.json({
            success: true,
            message: `Đã xóa thành công hồ sơ #${candidateId}`
        });
    } catch (error) {
        console.error("Error deleting candidate:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa hồ sơ ứng viên",
            error: error.message
        });
    }
});

// API xóa tin tuyển dụng (kèm tự động cascade xóa ứng viên liên quan)
app.delete("/api/jobs/:id", async (req, res) => {
    try {
        const jobId = req.params.id;
        await db.query("DELETE FROM jobs WHERE id = ?", [jobId]);
        res.json({
            success: true,
            message: `Đã xóa thành công vị trí #${jobId}`
        });
    } catch (error) {
        console.error("Error deleting job:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa vị trí tuyển dụng",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
