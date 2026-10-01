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

// Middleware
app.use(cors());
app.use(express.json());

// Kiểm tra backend
app.get("/", (req, res) => {
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
            SELECT c.id, c.job_id, c.name, c.email, c.cv_content, c.match_score, c.approval_status, c.ai_evaluation, c.created_at,
                   COALESCE(j.position, CONCAT('Vị trí #', c.job_id)) as position
            FROM candidates c
            LEFT JOIN jobs j ON c.job_id = j.id
            ORDER BY c.id DESC
            LIMIT 30
        `);

        res.json({
            success: true,
            candidates: candidates
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
