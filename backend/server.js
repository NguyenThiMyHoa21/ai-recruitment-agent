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

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
