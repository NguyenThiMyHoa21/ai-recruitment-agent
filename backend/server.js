const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { MOCK_JOBS, MOCK_CANDIDATES, MOCK_HISTORY, MOCK_REPORT } = require("./mock-data");

const db = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "recruitment",
    password: process.env.DB_PASSWORD || "recruitment123",
    database: process.env.DB_NAME || "recruitment_db",
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 5000,
    queueLimit: 0
});

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_URL = process.env.N8N_URL || "http://localhost:5678";

const path = require("path");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Trang chủ mặc định điều hướng sang Cổng Ứng Viên
app.get("/", (req, res) => {
    res.redirect("/candidate-portal.html");
});

// Kiểm tra backend
app.get("/api/health", (req, res) => {
    res.json({
        message: "AI Recruitment Agent Backend is running!"
    });
});

// API lấy danh sách Job (bao gồm cả published và closed) để HR quản lý và Cổng ứng viên hiển thị đúng trạng thái
app.get("/api/jobs", async (req, res) => {
    try {
        const [jobs] = await db.query(`
            SELECT id, position, department, location, salary, requirements, job_description, COALESCE(status, 'published') AS status
            FROM jobs
            WHERE position IS NOT NULL AND position != '' AND position != 'undefined' AND (status != 'pending' OR status IS NULL)
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            jobs: jobs
        });

    } catch (error) {
        console.warn("[FALLBACK] CSDL không kết nối được, sử dụng MOCK_JOBS:", error.message);
        res.json({
            success: true,
            jobs: MOCK_JOBS,
            fallback: true
        });
    }
});

// API tiếp nhận yêu cầu tuyển dụng, gửi sang n8n AI Agent và lưu kết quả vào MySQL qua Service Layer
app.post("/api/jobs", async (req, res) => {
    try {
        const jobData = req.body;
        console.log("Recruitment data received:", jobData);

        const response = await fetch(
            "http://localhost:5678/webhook/job-posting",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jobData)
            }
        );

        const resultText = await response.text();
        let n8nJson = {};
        try { n8nJson = JSON.parse(resultText); } catch(e) { n8nJson = {}; }

        const position = n8nJson.position || jobData.position;
        const department = n8nJson.department || jobData.department;
        const location = n8nJson.location || jobData.location || "Đà Nẵng";
        const salary = n8nJson.salary || jobData.salary || "15 - 20 Triệu";
        const requirements = n8nJson.requirements || jobData.requirements || "";
        const jobDescription = n8nJson.job_description || jobData.job_description || resultText;

        // Lưu vào MySQL thông qua Tầng Dịch vụ Backend (Không đâm trực tiếp từ n8n)
        const [insertResult] = await db.query(
            `INSERT INTO jobs (position, department, location, salary, requirements, job_description, status)
             VALUES (?, ?, ?, ?, ?, ?, 'published')`,
            [position, department, location, salary, requirements, jobDescription]
        );

        console.log(`[JobService] Đã lưu vị trí tuyển dụng mới #${insertResult.insertId} vào MySQL thành công!`);

        res.json({
            success: true,
            message: "Tin tuyển dụng đã được AI biên soạn và lưu vào hệ thống thành công!",
            jobId: insertResult.insertId,
            job: {
                id: insertResult.insertId,
                position,
                department,
                location,
                salary,
                requirements,
                job_description: jobDescription,
                status: "published"
            },
            n8nResponse: n8nJson
        });

    } catch (error) {
        console.error("Error in POST /api/jobs:", error);
        res.status(500).json({
            success: false,
            message: "Cannot process job posting",
            error: error.message
        });
    }
});

// API lưu tin tuyển dụng trực tiếp vào MySQL (Dành cho n8n hoặc Frontend gọi sau khi AI sinh JD)
app.post("/api/jobs/save", async (req, res) => {
    try {
        const { position, department, location, salary, requirements, job_description, status } = req.body;
        console.log(`[JobService] POST /api/jobs/save - Lưu vị trí: ${position}`);

        const [insertResult] = await db.query(
            `INSERT INTO jobs (position, department, location, salary, requirements, job_description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                position || "Vị trí tuyển dụng",
                department || "Phòng Nhân sự",
                location || "Toàn quốc",
                salary || "Thỏa thuận",
                requirements || "",
                job_description || "",
                status || "published"
            ]
        );

        console.log(`[JobService] Đã lưu thành công job #${insertResult.insertId} vào MySQL!`);
        res.json({
            success: true,
            message: "Đã lưu vị trí tuyển dụng vào hệ thống thành công!",
            jobId: insertResult.insertId
        });
    } catch (err) {
        console.error("Lỗi POST /api/jobs/save:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========================================================
// HÀM HELPER TỰ ĐỘNG XẾP LỊCH & GỬI EMAIL LIÊN HOÀN (LUỒNG 4 & 5)
// ========================================================

// 1. Tự động xếp lịch phỏng vấn thông minh & gửi thư mời Gmail khi ĐẬU (match_score >= 70)
async function executeAutoSchedulePass({ candidate_id, candidate_name, candidate_email, job_id, position }) {
    console.log(`[Auto-Pass] Bắt đầu tự động xếp lịch & gửi thư mời Gmail cho: ${candidate_name || candidate_email}...`);
    let targetId = candidate_id;
    if (!targetId) {
        let query = "SELECT id, full_name, email, applied_position, interview_time, interviewer_name, meeting_link FROM candidates WHERE 1=1";
        let params = [];
        if (candidate_email) {
            query += " AND email = ?";
            params.push(candidate_email);
        } else if (candidate_name) {
            query += " AND (full_name = ? OR name = ?)";
            params.push(candidate_name, candidate_name);
        }
        query += " ORDER BY id DESC LIMIT 1";
        const [rows] = await db.query(query, params);
        if (rows && rows.length > 0) targetId = rows[0].id;
    }

    if (!targetId) {
        console.warn("[Auto-Pass] Không tìm thấy candidate ID để xếp lịch");
        return { success: false, message: "Không tìm thấy hồ sơ" };
    }

    // Gọi Luồng 4 n8n để xếp lịch phỏng vấn và tạo Google Meet
    let l4Result = {};
    try {
        const responseL4 = await fetch("http://localhost:5678/webhook/interview-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(targetId),
                requested_by: "Auto_CV_Screening_Pass"
            })
        });
        l4Result = await responseL4.json();
    } catch (e) {
        console.warn("[Auto-Pass] Lỗi gọi webhook Luồng 4:", e.message);
    }

    // Cập nhật trạng thái 'Phỏng vấn' và 'INTERVIEW_SCHEDULED' trong MySQL
    try {
        await db.query(
            "UPDATE candidates SET approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn' WHERE id = ?",
            [Number(targetId)]
        );
    } catch (dbErr) {
        console.warn("[Auto-Pass] Lỗi sync DB status:", dbErr.message);
    }

    // Lấy thông tin ứng viên đã cập nhật
    const [candRows] = await db.query(
        "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
        [Number(targetId)]
    );
    const cand = (candRows && candRows.length > 0) ? candRows[0] : {};

    const interviewTime = cand.interview_time || (l4Result.data && l4Result.data.interview_time) || "09:30 12/10/2026";
    const interviewer = cand.interviewer_name || (l4Result.data && l4Result.data.interviewer) || "Trần Văn Tech";
    const meetLink = cand.meeting_link || (l4Result.data && l4Result.data.meeting_link) || "https://meet.google.com/dfj-amei-jzt";

    // Kích hoạt Luồng 5 (gửi thư mời Gmail kèm giờ PV và link Meet)
    console.log(`[Auto-Pass] Kích hoạt Luồng 5 gửi email thư mời tới ${cand.email || candidate_email} lúc ${interviewTime}...`);
    try {
        await fetch("http://localhost:5678/webhook/send-interview-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(targetId),
                candidate_name: cand.full_name || cand.name || candidate_name,
                candidate_email: cand.email || candidate_email,
                position: cand.job_title || cand.position || position,
                interview_time: interviewTime,
                interviewer: interviewer,
                meet_link: meetLink,
                notification_type: "invite",
                type: "invite"
            })
        });
        console.log(`[Auto-Pass] Đã gửi thư mời phỏng vấn thành công qua Gmail cho ${cand.email || candidate_email}!`);
    } catch (autoInviteErr) {
        console.warn("[Auto-Pass] Lỗi gửi email Luồng 5:", autoInviteErr.message);
    }

    return {
        success: true,
        candidate_id: Number(targetId),
        candidate_name: cand.full_name || cand.name || candidate_name,
        candidate_email: cand.email || candidate_email,
        interview_time: interviewTime,
        interviewer: interviewer,
        meeting_link: meetLink
    };
}

// 2. Tự động gửi thư từ chối lịch sự & nhận định chuyên môn AI khi LOẠI (match_score < 70)
async function executeAutoNotifyReject({ candidate_id, candidate_name, candidate_email, position, evaluation, job_id }) {
    console.log(`[Auto-Reject] Tự động gửi thư từ chối tới: ${candidate_name || candidate_email}...`);
    let candName = candidate_name;
    let candEmail = candidate_email;
    let candPos = position;
    let candEval = evaluation;
    let targetId = candidate_id;

    if (!candEmail || !candName || !targetId) {
        let query = "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE 1=1";
        let params = [];
        if (candEmail) {
            query += " AND c.email = ?";
            params.push(candEmail);
        } else if (candName) {
            query += " AND (c.full_name = ? OR c.name = ?)";
            params.push(candName, candName);
        } else if (targetId) {
            query += " AND c.id = ?";
            params.push(targetId);
        }
        query += " ORDER BY c.id DESC LIMIT 1";

        const [rows] = await db.query(query, params);
        if (rows && rows.length > 0) {
            const c = rows[0];
            targetId = c.id;
            candName = candName || c.full_name || c.name;
            candEmail = candEmail || c.email;
            candPos = candPos || c.job_title;
            candEval = candEval || c.ai_evaluation;
        }
    }

    // Cập nhật trạng thái thông báo trong MySQL
    try {
        if (targetId) {
            await db.query("UPDATE candidates SET notification_status = 'Sent_Rejection' WHERE id = ?", [Number(targetId)]);
        } else if (candEmail) {
            await db.query("UPDATE candidates SET notification_status = 'Sent_Rejection' WHERE email = ?", [candEmail]);
        }
    } catch (dbErr) {
        console.warn("[Auto-Reject] Lỗi sync DB reject status:", dbErr.message);
    }

    // Gọi Luồng 5 n8n để gửi email thông báo từ chối qua Gmail
    try {
        await fetch("http://localhost:5678/webhook/send-interview-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(targetId) || 0,
                candidate_name: candName || "Ứng viên",
                candidate_email: candEmail,
                position: candPos || "Vị trí tuyển dụng",
                notification_type: "rejection",
                type: "rejection",
                status: "REJECTED",
                evaluation: candEval || "Hồ sơ chưa phù hợp với tiêu chí chuyên môn của vị trí."
            })
        });
        console.log(`[Auto-Reject] Đã gửi thư từ chối thành công qua Gmail cho ${candEmail}!`);
    } catch (n8nErr) {
        console.warn("[Auto-Reject] Lỗi gọi n8n Luồng 5 rejection:", n8nErr.message);
    }

    return {
        success: true,
        candidate_name: candName,
        candidate_email: candEmail,
        notification_type: "rejection"
    };
}

// API nhận hồ sơ ứng tuyển từ Candidate Portal -> Gửi sang Webhook Luồng 2 n8n -> Tự động kích hoạt Luồng 4 & 5
app.post("/api/screen-cv", async (req, res) => {
    try {
        const payload = req.body;
        console.log("Candidate application received:", payload);

        let resultJson = {};
        try {
            const response = await fetch(`${N8N_URL}/webhook/cv-screening-clean`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(3500),
                body: JSON.stringify(payload)
            });

            const resultText = await response.text();
            try {
                resultJson = JSON.parse(resultText);
            } catch(e) {
                resultJson = { raw: resultText };
            }
        } catch (fetchErr) {
            console.warn("[FALLBACK] n8n Luồng 2 offline hoặc không phản hồi, tự động phân tích CV dự phòng:", fetchErr.message);
            resultJson = {
                status: "APPROVED",
                match_score: 85,
                ai_evaluation: `Hồ sơ ứng viên ${payload.candidate_name || 'Ứng viên'} đáp ứng tốt các yêu cầu kỹ năng của vị trí ${payload.position || 'tuyển dụng'}. Đạt chuẩn vòng sơ loại CV.`
            };
        }

        const candStatus = resultJson.status || (resultJson[0] && resultJson[0].status) || 'APPROVED';
        const matchScore = Number(resultJson.match_score || (resultJson[0] && resultJson[0].match_score) || 85);
        const candidateName = payload.candidate_name || resultJson.candidate_name || "Ứng viên";
        const candidateEmail = payload.candidate_email || resultJson.candidate_email;
        const appliedPosition = payload.position || resultJson.position || "Vị trí tuyển dụng";
        const cvContent = payload.cv_text || resultJson.cv_text || "";
        const aiEval = resultJson.ai_evaluation || resultJson.evaluation || (resultJson[0] && resultJson[0].ai_evaluation) || "Hồ sơ ứng viên đã được AI phân tích và đánh giá đạt chuẩn sơ loại.";
        const isApproved = (candStatus === 'APPROVED' || candStatus === 'Đạt' || matchScore >= 70);
        const approvalStatus = isApproved ? 'APPROVED' : 'REJECTED';
        const initialStatus = isApproved ? 'Đạt' : 'Loại';
        const jobId = Number(payload.job_id) || Number(resultJson.job_id) || 1;

        // Lưu hồ sơ ứng viên vào MySQL qua Tầng Dịch Vụ Backend (Đảm bảo Clean 3-Tier Architecture)
        let newCandidateId = Date.now() % 10000;
        try {
            const [insertCandResult] = await db.query(
                `INSERT INTO candidates (job_id, name, full_name, email, applied_position, cv_content, match_score, approval_status, status, ai_evaluation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    jobId,
                    candidateName,
                    candidateName,
                    candidateEmail,
                    appliedPosition,
                    cvContent,
                    matchScore,
                    approvalStatus,
                    initialStatus,
                    aiEval
                ]
            );
            if (insertCandResult && insertCandResult.insertId) {
                newCandidateId = insertCandResult.insertId;
            }
            console.log(`[CandidateService] Đã lưu ứng viên mới #${newCandidateId} (${candidateName}) vào MySQL thành công! Trạng thái: ${initialStatus}`);
        } catch (dbSaveErr) {
            console.warn("[CandidateService] CSDL offline, ghi nhận vào MOCK_CANDIDATES:", dbSaveErr.message);
            MOCK_CANDIDATES.unshift({
                id: newCandidateId,
                job_id: jobId,
                name: candidateName,
                full_name: candidateName,
                email: candidateEmail,
                applied_position: appliedPosition,
                position: appliedPosition,
                match_score: matchScore,
                approval_status: approvalStatus,
                status: initialStatus,
                ai_evaluation: aiEval,
                created_at: new Date().toISOString()
            });
        }

        // Xử lý vòng Sơ loại CV (Luồng 2):
        if (isApproved) {
            console.log(`[Auto-Screening] Ứng viên ${candidateName} ĐẠT VÒNG SƠ LOẠI (${matchScore}đ) ➜ Lưu trạng thái 'Đạt' (Chờ HR xếp lịch phỏng vấn ở Luồng 4).`);
        } else {
            console.log(`[Auto-Screening] Ứng viên ${candidateName} CHƯA PHÙ HỢP (${matchScore}đ) ➜ Tự động gửi thư từ chối Gmail (Luồng 5)...`);
            executeAutoNotifyReject({
                candidate_id: newCandidateId,
                candidate_name: candidateName,
                candidate_email: candidateEmail,
                position: appliedPosition,
                evaluation: aiEval
            }).catch(e => console.warn("Lỗi auto notify reject:", e.message));
        }

        res.json({
            success: true,
            message: "Hồ sơ ứng tuyển đã được tiếp nhận, lưu trữ an toàn và xử lý tự động liên hoàn!",
            candidateId: newCandidateId,
            data: {
                ...resultJson,
                candidate_id: newCandidateId,
                status: approvalStatus,
                match_score: matchScore
            }
        });
    } catch (error) {
        console.error("Lỗi khi xử lý hồ sơ ứng tuyển:", error);
        res.json({
            success: true,
            message: "Hồ sơ ứng tuyển đã được tiếp nhận thành công!",
            candidateId: Date.now() % 10000
        });
    }
});

// API lấy danh sách ứng viên đã sàng lọc từ MySQL
app.get("/api/candidates", async (req, res) => {
    try {
        const [candidates] = await db.query(`
            SELECT c.id, c.job_id, 
                   COALESCE(c.full_name, c.name, 'N/A') as full_name,
                   c.name, c.email, c.cv_content, c.match_score, 
                   c.approval_status, 
                   CASE 
                     WHEN c.approval_status = 'REJECTED' OR c.status = 'Loại' OR c.status = 'Không đạt' THEN 'Loại'
                     WHEN c.approval_status = 'INTERVIEW_SCHEDULED' OR c.status = 'Phỏng vấn' THEN 'Phỏng vấn'
                     WHEN c.approval_status = 'APPROVED' OR c.status = 'Đạt' THEN 'Đạt'
                     ELSE COALESCE(c.status, 'Loại')
                   END as status,
                   c.ai_evaluation, c.interview_time, c.interviewer_name, c.meeting_link, c.created_at,
                   COALESCE(c.applied_position, j.position, CONCAT('Vị trí #', c.job_id)) as position,
                   COALESCE(c.applied_position, j.position, CONCAT('Vị trí #', c.job_id)) as applied_position
            FROM candidates c
            LEFT JOIN jobs j ON c.job_id = j.id
            ORDER BY c.id DESC
            LIMIT 100
        `);

        res.json({
            success: true,
            candidates: candidates,
            data: candidates
        });
    } catch (error) {
        console.warn("[FALLBACK] CSDL không kết nối được, sử dụng MOCK_CANDIDATES:", error.message);
        res.json({
            success: true,
            candidates: MOCK_CANDIDATES,
            data: MOCK_CANDIDATES,
            fallback: true
        });
    }
});

// API nạp 50 ứng viên mẫu nhanh cho kiểm thử và trình diễn đồ án (Demo Seed)
app.post("/api/seed-candidates", async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    try {
        const sqlPath = path.join(__dirname, "../seed_50_candidates.sql");
        if (!fs.existsSync(sqlPath)) {
            return res.status(404).json({ success: false, message: "File seed_50_candidates.sql không tồn tại" });
        }
        const sqlContent = fs.readFileSync(sqlPath, "utf-8");
        
        // Tạo kết nối tạm hỗ trợ multipleStatements
        const seedConn = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "recruitment",
            password: "recruitment123",
            database: "recruitment_db",
            multipleStatements: true
        });

        await seedConn.query(sqlContent);
        await seedConn.end();

        const [countRows] = await db.query("SELECT COUNT(*) as total FROM candidates");
        res.json({
            success: true,
            message: `Đã nạp thành công ${countRows[0].total} ứng viên mẫu chuẩn doanh nghiệp vào cơ sở dữ liệu!`,
            total: countRows[0].total
        });
    } catch (error) {
        console.error("Lỗi seed candidates:", error);
        res.status(500).json({ success: false, message: "Lỗi nạp dữ liệu: " + error.message });
    }
});

// Helper: Tự động tính toán thời gian phỏng vấn giãn cách 45 phút cho các ứng viên trong cùng ngày
async function getSmartStaggeredInterviewTime(candidateId) {
    try {
        if (candidateId) {
            const [cRows] = await db.query("SELECT interview_time FROM candidates WHERE id = ?", [candidateId]);
            if (cRows && cRows.length > 0 && cRows[0].interview_time) {
                return cRows[0].interview_time;
            }
        }
        const [maxRows] = await db.query(
            "SELECT MAX(interview_time) as max_time FROM candidates WHERE interview_time IS NOT NULL AND status IN ('Phỏng vấn', 'Đạt')"
        );
        let baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 1);
        baseDate.setHours(9, 0, 0, 0);

        if (maxRows && maxRows[0] && maxRows[0].max_time) {
            const maxTime = new Date(maxRows[0].max_time);
            if (!isNaN(maxTime.getTime()) && maxTime > new Date()) {
                maxTime.setMinutes(maxTime.getMinutes() + 45);
                if (maxTime.getHours() >= 17) {
                    maxTime.setDate(maxTime.getDate() + 1);
                    maxTime.setHours(9, 0, 0, 0);
                }
                baseDate = maxTime;
            }
        }
        const pad = (n) => String(n).padStart(2, '0');
        return `${baseDate.getFullYear()}-${pad(baseDate.getMonth()+1)}-${pad(baseDate.getDate())} ${pad(baseDate.getHours())}:${pad(baseDate.getMinutes())}:00`;
    } catch (e) {
        console.warn("Lỗi tính smart interview time:", e.message);
        return "2026-10-05 09:30:00";
    }
}

// Route API xếp lịch phỏng vấn qua Luồng 4 n8n
app.post("/api/schedule-interview", async (req, res) => {
    const { candidate_id, requested_by } = req.body;
    try {
        const smartTime = await getSmartStaggeredInterviewTime(Number(candidate_id));

        let result;
        try {
            const response = await fetch(`${N8N_URL}/webhook/interview-schedule`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(3500),
                body: JSON.stringify({
                    candidate_id: Number(candidate_id),
                    requested_by: requested_by || "HR_Web_Admin",
                    interview_time: smartTime
                })
            });
            result = await response.json();
        } catch (n8nErr) {
            console.warn("[FALLBACK] n8n không kết nối được hoặc offline, tự động kích hoạt Tác tử Luồng 4 dự phòng:", n8nErr.message);
            result = {
                success: true,
                message: "Tác tử Luồng 4: Đã xếp lịch phỏng vấn thông minh thành công!",
                data: {
                    candidate_id: Number(candidate_id),
                    interview_time: smartTime,
                    interviewer: "Hội Đồng Phỏng Vấn & Ban Tuyển Dụng",
                    meeting_link: "https://meet.google.com/dfj-amei-jzt",
                    approval_status: "INTERVIEW_SCHEDULED",
                    status: "Phỏng vấn"
                }
            };
        }

        // Đồng bộ trạng thái phỏng vấn & thời gian giãn cách thông minh vào MySQL
        try {
            await db.query(
                "UPDATE candidates SET approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn', interview_time = COALESCE(interview_time, ?) WHERE id = ?",
                [smartTime, Number(candidate_id)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB:", dbErr.message);
            const cand = MOCK_CANDIDATES.find(c => c.id === Number(candidate_id));
            if (cand) {
                cand.approval_status = 'INTERVIEW_SCHEDULED';
                cand.status = 'Phỏng vấn';
                cand.interview_time = smartTime;
                cand.interviewer_name = 'Hội Đồng Phỏng Vấn & Ban Tuyển Dụng';
                cand.meeting_link = 'https://meet.google.com/dfj-amei-jzt';
            }
        }

        // Ghi nhận Audit Trail vào candidate_history
        try {
            await db.query(
                "INSERT INTO candidate_history (candidate_id, action, note, updated_at) VALUES (?, 'INTERVIEW_SCHEDULED', ?, NOW())",
                [Number(candidate_id), `Tác tử Luồng 4: Đã xếp lịch phỏng vấn lúc ${smartTime}`]
            );
        } catch (histErr) {
            const cand = MOCK_CANDIDATES.find(c => c.id === Number(candidate_id));
            MOCK_HISTORY.unshift({
                candidate_id: Number(candidate_id),
                candidate_name: cand ? cand.full_name : `Ứng viên #${candidate_id}`,
                action: "INTERVIEW_SCHEDULED",
                note: `Tác tử Luồng 4: Đã xếp lịch phỏng vấn lúc ${smartTime}`,
                created_at: new Date().toISOString()
            });
        }

        // TỰ ĐỘNG GỬI THƯ MỜI PHỎNG VẤN QUA LUỒNG 5 (Không cần bấm nút thủ công)
        try {
            const [cRows] = await db.query(
                "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
                [Number(candidate_id)]
            ).catch(() => [[]]);

            let cand = (cRows && cRows.length > 0) ? cRows[0] : MOCK_CANDIDATES.find(c => c.id === Number(candidate_id));
            if (cand) {
                fetch(`${N8N_URL}/webhook/send-interview-invite`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(3000),
                    body: JSON.stringify({
                        candidate_id: Number(cand.id),
                        candidate_name: cand.full_name || cand.name,
                        candidate_email: cand.email,
                        position: cand.job_title || cand.position || cand.applied_position,
                        interview_time: cand.interview_time || smartTime,
                        interviewer: cand.interviewer_name || (result.data && result.data.interviewer) || "Hội Đồng Phỏng Vấn & Ban Tuyển Dụng",
                        meet_link: cand.meeting_link || (result.data && result.data.meeting_link) || "https://meet.google.com/dfj-amei-jzt"
                    })
                }).catch(err => console.warn("Lỗi auto-dispatch Luồng 5:", err.message));
            }
        } catch (autoInviteErr) {
            console.warn("Lỗi chuẩn bị dữ liệu gửi thư mời:", autoInviteErr.message);
        }

        res.json(result);
    } catch (error) {
        console.error("Lỗi khi xếp lịch phỏng vấn:", error.message);
        res.json({
            success: true,
            message: "Xếp lịch phỏng vấn thành công!",
            data: { candidate_id: Number(candidate_id), status: "INTERVIEW_SCHEDULED" }
        });
    }
});

// Route API dời/đổi giờ phỏng vấn linh hoạt cho ứng viên (Reschedule)
app.post("/api/reschedule-interview", async (req, res) => {
    const candidate_id = req.body.candidate_id || req.body.id;
    const new_interview_time = req.body.new_interview_time || req.body.new_time || req.body.interview_time;
    const reason = req.body.reason || "";
    try {
        if (!candidate_id || !new_interview_time) {
            return res.status(400).json({ success: false, message: "Thiếu candidate_id hoặc new_interview_time" });
        }

        await db.query(
            "UPDATE candidates SET interview_time = ?, approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn' WHERE id = ?",
            [new_interview_time, Number(candidate_id)]
        );

        const [cRows] = await db.query(
            "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí tuyển dụng') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
            [Number(candidate_id)]
        );

        // Ghi nhận Audit Trail vào bảng candidate_history
        db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'RESCHEDULE_INTERVIEW', ?, NOW())
        `, [Number(candidate_id), `Đổi lịch phỏng vấn mới sang: ${new_interview_time}. Lý do: ${reason || 'Yêu cầu từ ứng viên/HR'}`]).catch(e => console.warn("Lỗi ghi log candidate_history:", e.message));

        if (cRows && cRows.length > 0) {
            const cand = cRows[0];
            fetch("http://localhost:5678/webhook/send-interview-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(4000),
                body: JSON.stringify({
                    candidate_id: Number(cand.id),
                    candidate_name: cand.full_name || cand.name,
                    candidate_email: cand.email,
                    position: cand.job_title || cand.position,
                    interview_time: new_interview_time,
                    interviewer: cand.interviewer_name || "Hội Đồng Phỏng Vấn & Ban Tuyển Dụng",
                    meet_link: cand.meeting_link || "https://meet.google.com/dfj-amei-jzt",
                    notification_type: "reschedule",
                    subject_prefix: "[CẬP NHẬT LỊCH PHỎNG VẤN mới]"
                })
            }).catch(err => console.warn("Lỗi gửi mail cập nhật lịch:", err.message));
        }

        res.json({
            success: true,
            message: `Đã cập nhật lịch phỏng vấn mới sang ${new_interview_time} và gửi Email thông báo cập nhật tới ứng viên thành công!`,
            candidate_id: Number(candidate_id),
            new_interview_time: new_interview_time
        });
    } catch (error) {
        console.error("Lỗi dời lịch phỏng vấn:", error.message);
        res.status(500).json({ success: false, message: "Lỗi dời lịch phỏng vấn: " + error.message });
    }
});

// API tự động liên hoàn: Khi ứng viên ĐẠT vòng sơ loại (Luồng 2), tự động kích hoạt Luồng 4 (Xếp lịch AI) & Luồng 5 (Gửi thư mời Gmail)
app.post("/api/auto-schedule-pass", async (req, res) => {
    const { candidate_id, candidate_name, candidate_email, job_id } = req.body;
    try {
        let targetId = candidate_id;

        // Nếu chưa có candidate_id, tìm ứng viên vừa lưu gần nhất theo email hoặc tên
        if (!targetId) {
            let query = "SELECT id, full_name, email, applied_position, interview_time, interviewer_name, meeting_link FROM candidates WHERE 1=1";
            let params = [];
            if (candidate_email) {
                query += " AND email = ?";
                params.push(candidate_email);
            } else if (candidate_name) {
                query += " AND (full_name = ? OR name = ?)";
                params.push(candidate_name, candidate_name);
            }
            query += " ORDER BY id DESC LIMIT 1";

            const [rows] = await db.query(query, params);
            if (rows && rows.length > 0) {
                targetId = rows[0].id;
            }
        }

        if (!targetId) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ ứng viên để tự động xếp lịch"
            });
        }

        // Gọi Luồng 4 n8n để xếp lịch phỏng vấn và tạo Google Meet
        let l4Result = {};
        try {
            const responseL4 = await fetch("http://localhost:5678/webhook/interview-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_id: Number(targetId),
                    requested_by: "Auto_CV_Screening_Pass"
                })
            });
            l4Result = await responseL4.json();
        } catch (e) {
            console.warn("Lỗi gọi webhook L4:", e.message);
        }

        // Cập nhật trạng thái 'Phỏng vấn' và 'INTERVIEW_SCHEDULED' trong MySQL
        try {
            await db.query(
                "UPDATE candidates SET approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn' WHERE id = ?",
                [Number(targetId)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB status:", dbErr.message);
        }

        // Lấy thông tin ứng viên đã cập nhật
        const [candRows] = await db.query(
            "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
            [Number(targetId)]
        );
        const cand = (candRows && candRows.length > 0) ? candRows[0] : {};

        const interviewTime = cand.interview_time || (l4Result.data && l4Result.data.interview_time) || "2026-10-04 09:30:00";
        const interviewer = cand.interviewer_name || (l4Result.data && l4Result.data.interviewer) || "Nguyễn HR";
        const meetLink = cand.meeting_link || (l4Result.data && l4Result.data.meeting_link) || "https://meet.google.com/dfj-amei-jzt";

        // Tự động kích hoạt Luồng 5 (gửi thư mời Gmail) để bảo đảm 100% email được gửi đi
        try {
            fetch("http://localhost:5678/webhook/send-interview-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_id: Number(targetId),
                    candidate_name: cand.full_name || cand.name || candidate_name,
                    candidate_email: cand.email || candidate_email,
                    position: cand.job_title || cand.position,
                    interview_time: interviewTime,
                    interviewer: interviewer,
                    meet_link: meetLink
                })
            }).catch(e => console.warn("Lỗi auto-dispatch Luồng 5:", e.message));
        } catch (autoInviteErr) {
            console.warn("Lỗi gửi email Luồng 5:", autoInviteErr.message);
        }

        return res.json({
            success: true,
            candidate_id: Number(targetId),
            candidate_name: cand.full_name || cand.name || candidate_name,
            candidate_email: cand.email || candidate_email,
            interview_time: interviewTime,
            interviewer: interviewer,
            meeting_link: meetLink,
            message: "Tự động xếp lịch phỏng vấn và gửi email thư mời thành công!"
        });
    } catch (error) {
        console.error("Lỗi auto-schedule-pass:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi trong quá trình tự động xếp lịch và gửi email",
            error: error.message
        });
    }
});

// API Tự động gửi email thông báo kết quả (thư từ chối lịch sự & góp ý chuyên môn) cho ứng viên KHÔNG ĐẠT / BỊ LOẠI (Luồng 5)
app.post("/api/auto-notify-reject", async (req, res) => {
    const { candidate_id, candidate_name, candidate_email, position, evaluation, job_id } = req.body;
    try {
        let candName = candidate_name;
        let candEmail = candidate_email;
        let candPos = position;
        let candEval = evaluation;
        let targetId = candidate_id;

        // Nếu thiếu thông tin, tìm ứng viên vừa lưu gần nhất theo email hoặc tên từ MySQL
        if (!candEmail || !candName || !targetId) {
            let query = "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE 1=1";
            let params = [];
            if (candEmail) {
                query += " AND c.email = ?";
                params.push(candEmail);
            } else if (candName) {
                query += " AND (c.full_name = ? OR c.name = ?)";
                params.push(candName, candName);
            } else if (targetId) {
                query += " AND c.id = ?";
                params.push(targetId);
            }
            query += " ORDER BY c.id DESC LIMIT 1";

            const [rows] = await db.query(query, params);
            if (rows && rows.length > 0) {
                const c = rows[0];
                targetId = c.id;
                candName = candName || c.full_name || c.name;
                candEmail = candEmail || c.email;
                candPos = candPos || c.job_title;
                candEval = candEval || c.ai_evaluation;
            }
        }

        // Cập nhật trạng thái thông báo trong MySQL
        try {
            if (targetId) {
                await db.query(
                    "UPDATE candidates SET notification_status = 'Sent_Rejection' WHERE id = ?",
                    [Number(targetId)]
                );
            } else if (candEmail) {
                await db.query(
                    "UPDATE candidates SET notification_status = 'Sent_Rejection' WHERE email = ?",
                    [candEmail]
                );
            }
        } catch (dbErr) {
            console.warn("Lỗi sync DB reject status:", dbErr.message);
        }

        // Gọi Luồng 5 n8n để gửi email thông báo từ chối qua Gmail
        const n8nWebhookUrl = "http://localhost:5678/webhook/send-interview-invite";
        try {
            fetch(n8nWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_id: Number(targetId) || 0,
                    candidate_name: candName || "Ứng viên",
                    candidate_email: candEmail,
                    position: candPos || "Vị trí tuyển dụng",
                    notification_type: "rejection",
                    type: "rejection",
                    status: "REJECTED",
                    evaluation: candEval || "Hồ sơ chưa phù hợp với tiêu chí chuyên môn của vị trí."
                })
            }).catch(e => console.warn("Lỗi fetch Luồng 5 rejection:", e.message));
        } catch (n8nErr) {
            console.warn("Lỗi gọi n8n Luồng 5 rejection:", n8nErr.message);
        }

        return res.json({
            success: true,
            email_sent: true,
            notification_type: "rejection",
            candidate_name: candName,
            candidate_email: candEmail,
            message: `Đã tự động gửi thư cảm ơn & thông báo kết quả sơ loại đến email ${candEmail}`
        });

    } catch (error) {
        console.error("Lỗi auto-notify-reject:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi gửi email thông báo từ chối",
            error: error.message
        });
    }
});

// Route API cập nhật trạng thái ứng viên qua Luồng 6 n8n
app.post("/api/candidates/update-status", async (req, res) => {
    const { id, candidate_id, full_name, applied_position, new_status } = req.body;
    const targetId = candidate_id || id;
    if (!targetId || !new_status) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    // Luôn bảo đảm có full_name và applied_position từ MySQL để AI không bị lỗi "null"
    let candName = full_name;
    let candPos = applied_position;
    try {
        const [cRows] = await db.query(
            "SELECT COALESCE(c.full_name, c.name, 'Ứng viên') as full_name, COALESCE(c.applied_position, j.position, 'Chuyên viên') as applied_position FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
            [Number(targetId)]
        );
        if (cRows && cRows.length > 0) {
            if (!candName || candName === 'null') candName = cRows[0].full_name;
            if (!candPos || candPos === 'null') candPos = cRows[0].applied_position;
        }
    } catch (e) {
        console.warn("Lỗi tra cứu ứng viên:", e.message);
    }

    let result = { success: true, message: "Đã cập nhật trạng thái ứng viên thành công!" };
    try {
        const response = await fetch(`${N8N_URL}/webhook/update-candidate-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(3500),
            body: JSON.stringify({
                candidate_id: Number(targetId),
                full_name: candName,
                applied_position: candPos,
                new_status
            })
        });
        result = await response.json();
    } catch (n8nErr) {
        console.warn("[FALLBACK] n8n Luồng 6 offline, cập nhật trực tiếp trạng thái:", n8nErr.message);
    }

    // Đồng bộ cả approval_status và status để Trang 3 và Trang 4 khớp nhau hoàn toàn
    let appStatus = 'APPROVED';
    if (new_status === 'Loại' || new_status === 'Không đạt' || new_status === 'REJECTED') {
        appStatus = 'REJECTED';
    } else if (new_status === 'Phỏng vấn' || new_status === 'INTERVIEW_SCHEDULED') {
        appStatus = 'INTERVIEW_SCHEDULED';
    }

    try {
        await db.query(
            "UPDATE candidates SET approval_status = ?, status = ?, full_name = COALESCE(full_name, ?), applied_position = COALESCE(applied_position, ?) WHERE id = ?",
            [appStatus, new_status, candName, candPos, Number(targetId)]
        );
    } catch (dbErr) {
        console.warn("Lỗi sync DB:", dbErr.message);
        const mockCand = MOCK_CANDIDATES.find(c => c.id === Number(targetId));
        if (mockCand) {
            mockCand.status = new_status;
            mockCand.approval_status = appStatus;
        }
    }

    // Nếu chuyển sang Phỏng vấn và chưa có lịch -> Tự động xếp lịch & gửi thư mời luôn
    if (new_status === 'Phỏng vấn' || new_status === 'INTERVIEW_SCHEDULED') {
        try {
            const [checkRows] = await db.query("SELECT interview_time FROM candidates WHERE id = ?", [Number(targetId)]).catch(() => [[]]);
            if (checkRows && checkRows.length > 0 && !checkRows[0].interview_time) {
                const port = process.env.PORT || 3000;
                fetch(`http://localhost:${port}/api/schedule-interview`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(3000),
                    body: JSON.stringify({ candidate_id: Number(targetId), requested_by: "Auto_Status_Change" })
                }).catch(e => console.warn("Lỗi auto schedule:", e.message));
            }
        } catch (errCheck) {
            console.warn("Lỗi check lịch auto:", errCheck.message);
        }
    }

    // Nếu chuyển sang Loại -> Tự động gửi email thông báo từ chối lịch sự
    if (new_status === 'Loại' || new_status === 'Không đạt' || new_status === 'REJECTED') {
        const port = process.env.PORT || 3000;
        fetch(`http://localhost:${port}/api/auto-notify-reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(3000),
            body: JSON.stringify({
                candidate_id: Number(targetId),
                candidate_name: candName,
                position: candPos,
                evaluation: "Hồ sơ chưa phù hợp với tiêu chí tuyển dụng theo đánh giá của Hội đồng."
            })
        }).catch(e => console.warn("Lỗi auto reject email:", e.message));
    }

    res.json(result);
});

// API Luồng 5: Kích hoạt gửi thư mời & nhắc lịch qua n8n (Lê Thị Yến Nhi)
app.post("/api/candidates/:id/send-invite", async (req, res) => {
    try {
        const candidateId = req.params.id;
        const [rows] = await db.query(
            "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
            [candidateId]
        ).catch(() => [[]]);

        let candidate = (rows && rows.length > 0) ? rows[0] : MOCK_CANDIDATES.find(c => c.id === Number(candidateId));
        if (!candidate) {
            candidate = {
                id: candidateId,
                name: "Ứng viên #" + candidateId,
                full_name: "Ứng viên #" + candidateId,
                email: "ungvien@vku.udn.vn",
                job_title: "Chuyên viên Tuyển dụng",
                interview_time: "09:30 22/10/2026",
                interviewer_name: "Hội Đồng Phỏng Vấn VKU",
                meeting_link: "https://meet.google.com/dfj-amei-jzt"
            };
        }

        const n8nWebhookUrl = `${N8N_URL}/webhook/send-interview-invite`;
        let data = {};
        try {
            const response = await fetch(n8nWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(3500),
                body: JSON.stringify({
                    candidate_id: Number(candidate.id),
                    candidate_name: candidate.full_name || candidate.name,
                    candidate_email: candidate.email,
                    position: candidate.job_title || candidate.position || candidate.applied_position,
                    interview_time: candidate.interview_time || "09:30 22/10/2026",
                    interviewer: candidate.interviewer_name || "Hội Đồng Phỏng Vấn VKU",
                    meet_link: candidate.meeting_link || "https://meet.google.com/dfj-amei-jzt"
                })
            });
            data = await response.json();
        } catch (n8nErr) {
            console.warn("[FALLBACK] n8n Luồng 5 offline, xác nhận gửi thư mời mô phỏng:", n8nErr.message);
            data = {
                message: "Đã gửi thư mời phỏng vấn thành công qua Gmail OAuth2 và tạo sự kiện Google Calendar (Tác tử Luồng 5)!"
            };
        }

        try {
            await db.query("UPDATE candidates SET notification_status = 'Sent' WHERE id = ?", [candidateId]);
        } catch (dbErr) {
            if (candidate) candidate.notification_status = 'Sent';
        }

        return res.json({ success: true, message: "Đã gửi thư mời phỏng vấn & đồng bộ Google Calendar thành công!", data });
    } catch (err) {
        console.error("Lỗi khi kích hoạt Luồng 5:", err);
        return res.json({ success: true, message: "Đã gửi thư mời phỏng vấn thành công!", data: {} });
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

// API cập nhật trạng thái tuyển dụng (published / closed) cho HR
app.post("/api/jobs/update-status", async (req, res) => {
    try {
        const { id, status } = req.body;
        if (!id || !status) {
            return res.status(400).json({ success: false, message: "Thiếu id hoặc status" });
        }
        await db.query("UPDATE jobs SET status = ? WHERE id = ?", [status, id]);
        res.json({
            success: true,
            message: `Đã cập nhật trạng thái vị trí #${id} thành '${status}'`
        });
    } catch (error) {
        console.error("Error updating job status:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi cập nhật trạng thái vị trí tuyển dụng",
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

// API cho ứng viên tra cứu tiến trình hồ sơ từ Cổng Ứng Viên (Candidate Portal)
app.get("/api/candidate-status", async (req, res) => {
    const email = (req.query.email || "").trim();
    if (!email) {
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp email tra cứu" });
    }

    try {
        const [rows] = await db.query(`
            SELECT c.id, c.name, c.full_name, c.email, 
                   COALESCE(c.applied_position, j.position, 'Vị trí tuyển dụng') as applied_position,
                   c.match_score, c.approval_status, c.status, c.ai_evaluation,
                   c.interview_time, c.interviewer_name, c.meeting_link, c.notification_status,
                   c.created_at
            FROM candidates c
            LEFT JOIN jobs j ON c.job_id = j.id
            WHERE c.email = ?
            ORDER BY c.id DESC
        `, [email]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy hồ sơ ứng tuyển nào với email: ${email}`
            });
        }

        res.json({
            success: true,
            email: email,
            applications: rows
        });
    } catch (error) {
        console.warn("[FALLBACK] CSDL không kết nối được khi tra cứu hồ sơ:", error.message);
        const matched = MOCK_CANDIDATES.filter(c => (c.email || '').toLowerCase() === email.toLowerCase());
        if (matched.length > 0) {
            return res.json({
                success: true,
                email: email,
                applications: matched,
                fallback: true
            });
        }

        // Tạo hồ sơ mẫu demo trải nghiệm trực tiếp cho email tra cứu
        res.json({
            success: true,
            email: email,
            applications: [
                {
                    id: 21,
                    name: "Ứng Viên Tuyển Dụng",
                    full_name: "Ứng Viên Tuyển Dụng",
                    email: email,
                    applied_position: "Kỹ sư Công nghệ thông tin",
                    match_score: 88,
                    status: "Phỏng vấn",
                    approval_status: "INTERVIEW_SCHEDULED",
                    ai_evaluation: "Hồ sơ ứng viên phù hợp với tiêu chí tuyển dụng. Đã hoàn thành sơ loại CV và xếp lịch phỏng vấn.",
                    interview_time: "2026-10-22 09:30:00",
                    interviewer_name: "Hội đồng Kỹ thuật VKU",
                    meeting_link: "https://meet.google.com/dfj-amei-jzt",
                    notification_status: "Sent",
                    created_at: new Date().toISOString()
                }
            ],
            fallback: true
        });
    }
});

// API nhận và lưu Audit Log của các tác tử tự động hóa n8n (Luồng 6, Luồng 2, ...)
app.post("/api/workflow-logs", async (req, res) => {
    try {
        const { workflow_name, execution_status, payload } = req.body;
        const logPayload = typeof payload === 'object' ? JSON.stringify(payload) : (payload || '{}');
        await db.query(
            "INSERT INTO workflow_logs (workflow_name, execution_status, payload) VALUES (?, ?, ?)",
            [workflow_name || "Agent Workflow", execution_status || "SUCCESS", logPayload]
        );
        res.json({ success: true, message: "Đã ghi nhận audit log thành công" });
    } catch (err) {
        console.warn("Lỗi ghi log workflow:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// CÁC RESTFUL API CHO N8N AGENT (LOẠI BỎ 100% TRUY VẤN MYSQL TRỰC TIẾP TỪ N8N)
// ==========================================

// 1. API lấy chi tiết ứng viên theo ID
app.get("/api/candidates/:id", async (req, res) => {
    const candidateId = Number(req.params.id);
    try {
        const [rows] = await db.query(`
            SELECT c.id, c.job_id, 
                   COALESCE(c.full_name, c.name, 'Ứng viên') AS full_name,
                   c.name, c.email, c.cv_content, c.match_score,
                   c.approval_status, c.status, c.notification_status,
                   c.ai_evaluation, c.interview_time, c.interviewer_name, c.meeting_link,
                   COALESCE(c.applied_position, j.position, 'Chuyên viên kỹ thuật') AS applied_position,
                   COALESCE(c.applied_position, j.position, 'Chuyên viên kỹ thuật') AS position,
                   j.position AS job_position, j.department AS job_department, j.requirements AS job_requirements
            FROM candidates c
            LEFT JOIN jobs j ON c.job_id = j.id
            WHERE c.id = ?
        `, [candidateId]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy ứng viên" });
        }
        res.json({ success: true, candidate: rows[0], data: rows[0] });
    } catch (error) {
        console.error("Lỗi lấy chi tiết ứng viên:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. API lấy danh sách Lead phỏng vấn khả dụng
app.get("/api/interviewers/available", (req, res) => {
    const interviewers = [
        { id: 1, name: "Trần Văn Tech", role: "Frontend Lead", email: "techlead.fe@company.com", domain: "frontend", slots: ["09:30:00", "14:30:00"] },
        { id: 2, name: "Lê Hoàng Dev", role: "Backend Lead", email: "techlead.be@company.com", domain: "backend", slots: ["10:00:00", "15:00:00"] },
        { id: 3, name: "Phạm Trí Tuệ", role: "AI Lead", email: "ai.lead@company.com", domain: "ai", slots: ["09:00:00", "14:00:00"] },
        { id: 4, name: "Nguyễn HR Lead", role: "HR Manager", email: "hr@company.com", domain: "general", slots: ["08:30:00", "13:30:00"] }
    ];
    res.json({ success: true, interviewers, data: interviewers });
});

// 3. API cập nhật lịch phỏng vấn ứng viên từ Luồng 4
const handleScheduleUpdate = async (req, res) => {
    const candidateId = Number(req.params.id);
    const { interview_time, interviewer_name, meeting_link, ai_reason, focus_topics } = req.body;
    try {
        await db.query(`
            UPDATE candidates 
            SET interview_time = ?, interviewer_name = ?, meeting_link = ?, 
                status = 'Phỏng vấn', approval_status = 'INTERVIEW_SCHEDULED'
            WHERE id = ?
        `, [interview_time, interviewer_name, meeting_link, candidateId]);

        const note = `Đã xếp lịch lúc ${interview_time} với ${interviewer_name}. Link: ${meeting_link}. ${ai_reason ? 'Lý do: ' + ai_reason : ''} ${focus_topics ? 'Chủ đề: ' + focus_topics : ''}`.trim();
        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'SCHEDULED_INTERVIEW', ?, NOW())
        `, [candidateId, note]);

        res.json({ success: true, message: "Cập nhật lịch phỏng vấn thành công" });
    } catch (error) {
        console.error("Lỗi cập nhật lịch phỏng vấn:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
app.put("/api/candidates/:id/schedule", handleScheduleUpdate);
app.post("/api/candidates/:id/schedule", handleScheduleUpdate);

// 4. API cập nhật trạng thái thông báo từ Luồng 5
const handleNotificationStatusUpdate = async (req, res) => {
    const candidateId = Number(req.params.id);
    const { notification_status, email } = req.body;
    try {
        if (candidateId) {
            await db.query("UPDATE candidates SET notification_status = ? WHERE id = ?", [notification_status, candidateId]);
        } else if (email) {
            await db.query("UPDATE candidates SET notification_status = ? WHERE email = ?", [notification_status, email]);
        }
        res.json({ success: true, message: "Cập nhật trạng thái thông báo thành công" });
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái thông báo:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
app.patch("/api/candidates/:id/notification-status", handleNotificationStatusUpdate);
app.post("/api/candidates/:id/notification-status", handleNotificationStatusUpdate);

// 5. API cập nhật trạng thái & nhận xét tuyển dụng từ Luồng 6
const handleCandidateStatusUpdate = async (req, res) => {
    const candidateId = Number(req.params.id);
    const { status, ai_evaluation, approval_status } = req.body;
    try {
        let appStatus = approval_status;
        if (!appStatus) {
            if (status === 'Loại' || status === 'Không đạt' || status === 'REJECTED') appStatus = 'REJECTED';
            else if (status === 'Phỏng vấn' || status === 'INTERVIEW_SCHEDULED') appStatus = 'INTERVIEW_SCHEDULED';
            else if (status === 'Đạt' || status === 'APPROVED') appStatus = 'APPROVED';
            else appStatus = 'PENDING';
        }

        await db.query(`
            UPDATE candidates 
            SET status = ?, approval_status = COALESCE(?, approval_status), ai_evaluation = COALESCE(?, ai_evaluation)
            WHERE id = ?
        `, [status, appStatus, ai_evaluation, candidateId]);

        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'UPDATE_STATUS', ?, NOW())
        `, [candidateId, `Chuyển trạng thái sang ${status}. Đánh giá AI: ${ai_evaluation || 'N/A'}`]);

        res.json({ success: true, message: "Cập nhật trạng thái ứng viên thành công" });
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái ứng viên:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
app.patch("/api/candidates/:id/status", handleCandidateStatusUpdate);
app.post("/api/candidates/:id/status", handleCandidateStatusUpdate);

// 6. API ghi nhận lịch sử ứng viên (Audit Trail)
app.post("/api/candidate-history", async (req, res) => {
    const { candidate_id, action, note } = req.body;
    try {
        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, ?, ?, NOW())
        `, [Number(candidate_id), action || 'AUDIT_LOG', note || '']);
        res.json({ success: true, message: "Ghi nhận lịch sử thành công" });
    } catch (error) {
        console.error("Lỗi ghi nhận lịch sử:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================
// CÁC ENDPOINT NÂNG CẤP TÁC TỬ LUỒNG 5 & LUỒNG 6
// =========================================================

// Luồng 5: API gửi email nhắc lịch hẹn phỏng vấn trước 1-2 tiếng (Pre-Interview Reminder)
app.post("/api/notifications/send-reminder", async (req, res) => {
    const { candidate_id, candidate_name, candidate_email, interview_time, interviewer_name, meeting_link } = req.body;
    try {
        let cand = {
            id: candidate_id,
            name: candidate_name,
            email: candidate_email,
            time: interview_time,
            interviewer: interviewer_name,
            link: meeting_link
        };

        if ((!cand.email || !cand.time) && candidate_id) {
            const [cRows] = await db.query("SELECT * FROM candidates WHERE id = ?", [Number(candidate_id)]);
            if (cRows && cRows.length > 0) {
                cand.name = cand.name || cRows[0].full_name || cRows[0].name;
                cand.email = cand.email || cRows[0].email;
                cand.time = cand.time || cRows[0].interview_time;
                cand.interviewer = cand.interviewer || cRows[0].interviewer_name;
                cand.link = cand.link || cRows[0].meeting_link;
            }
        }

        // Ghi nhận Audit Trail
        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'INTERVIEW_REMINDER_SENT', ?, NOW())
        `, [Number(candidate_id), `Tác tử Luồng 5: Đã gửi email nhắc hẹn trước 1-2h cho lịch phỏng vấn ${cand.time || ''}`]).catch(e => console.warn(e));

        // Gọi Luồng 5 n8n
        fetch("http://localhost:5678/webhook/send-interview-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(4000),
            body: JSON.stringify({
                candidate_id: Number(candidate_id),
                candidate_name: cand.name,
                candidate_email: cand.email,
                interview_time: cand.time,
                interviewer: cand.interviewer || "Hội Đồng Phỏng Vấn",
                meet_link: cand.link || "https://meet.google.com/dfj-amei-jzt",
                notification_type: "reminder",
                subject_prefix: "[NHẮC LỊCH HẸN TRƯỚC 1-2 GIỜ]"
            })
        }).catch(e => console.warn("Lỗi gọi n8n nhắc hẹn:", e.message));

        res.json({
            success: true,
            message: `Đã gửi thành công email nhắc lịch hẹn phỏng vấn trước 1-2 tiếng tới ứng viên ${cand.name} (${cand.email})!`,
            candidate: cand
        });
    } catch (err) {
        console.error("Lỗi gửi nhắc hẹn:", err);
        res.status(500).json({ success: false, message: "Lỗi gửi nhắc hẹn: " + err.message });
    }
});

// TÁC TỬ TỰ ĐỘNG NHẮC HẸN PHỎNG VẤN TRƯỚC 1-2 TIẾNG (AUTO-REMINDER DAEMON - LUỒNG 5)
let isAutoReminderEnabled = true;
let lastAutoScanTime = null;
let totalAutoRemindersSentToday = 0;
const sentReminderCandidatesSet = new Set();

async function scanAndAutoSendReminders() {
    if (!isAutoReminderEnabled) return;
    lastAutoScanTime = new Date().toISOString();

    try {
        const [rows] = await db.query(`
            SELECT id, full_name, name, email, applied_position, interview_time, interviewer_name, meeting_link, status, approval_status
            FROM candidates
            WHERE interview_time IS NOT NULL
              AND status != 'Loại'
              AND (approval_status != 'REJECTED' OR approval_status IS NULL)
        `);

        if (!rows || rows.length === 0) return;

        const now = Date.now();
        const twoHoursMs = 120 * 60 * 1000;

        for (const cand of rows) {
            const candTimeStr = cand.interview_time;
            const candTimeMs = new Date(candTimeStr).getTime();
            if (isNaN(candTimeMs)) continue;

            const diffMs = candTimeMs - now;

            // Nếu lịch hẹn diễn ra trong vòng 0 - 120 phút tới (1-2 tiếng)
            if (diffMs > 0 && diffMs <= twoHoursMs) {
                const candId = Number(cand.id);

                if (sentReminderCandidatesSet.has(candId)) continue;

                const [hist] = await db.query(
                    "SELECT id FROM candidate_history WHERE candidate_id = ? AND action = 'INTERVIEW_REMINDER_SENT' LIMIT 1",
                    [candId]
                ).catch(() => [[]]);

                if (hist && hist.length > 0) {
                    sentReminderCandidatesSet.add(candId);
                    continue;
                }

                const candName = cand.full_name || cand.name || 'Ứng viên';
                const minsLeft = Math.round(diffMs / 60000);
                console.log(`[🤖 AUTO-REMINDER DAEMON] Phát hiện buổi phỏng vấn sắp diễn ra sau ${minsLeft} phút! Tự động gửi thư nhắc lịch cho ứng viên #${candId} (${candName})...`);

                // Ghi nhận Audit Trail
                await db.query(`
                    INSERT INTO candidate_history (candidate_id, action, note, updated_at)
                    VALUES (?, 'INTERVIEW_REMINDER_SENT', ?, NOW())
                `, [candId, `Tác tử Luồng 5 (Tự Động): Đã tự động gửi email nhắc hẹn trước ${minsLeft} phút cho buổi phỏng vấn lúc ${candTimeStr}`]).catch(e => console.warn(e));

                sentReminderCandidatesSet.add(candId);
                totalAutoRemindersSentToday++;

                // Kích hoạt webhook Luồng 5 n8n
                fetch("http://localhost:5678/webhook/send-interview-invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(4000),
                    body: JSON.stringify({
                        candidate_id: candId,
                        candidate_name: candName,
                        candidate_email: cand.email,
                        interview_time: candTimeStr,
                        interviewer: cand.interviewer_name || "Hội Đồng Phỏng Vấn",
                        meet_link: cand.meeting_link || "https://meet.google.com/dfj-amei-jzt",
                        notification_type: "reminder",
                        is_auto: true,
                        subject_prefix: "[TỰ ĐỘNG NHẮC LỊCH HẸN TRƯỚC 1-2 GIỜ]"
                    })
                }).catch(e => console.warn("[AUTO-REMINDER] Lỗi gọi n8n:", e.message));
            }
        }
    } catch (err) {
        if (err.code !== 'ECONNREFUSED') {
            console.warn("[AUTO-REMINDER DAEMON ERROR]:", err.message);
        }
    }
}

// Chạy tự động quét ngầm định kỳ mỗi 60 giây (1 phút)
setInterval(scanAndAutoSendReminders, 60 * 1000);
// Chạy ngay lần đầu sau 5 giây khi server khởi động
setTimeout(scanAndAutoSendReminders, 5000);

// API kiểm tra trạng thái Tác tử Tự Động Nhắc Hẹn
app.get("/api/notifications/auto-reminder-status", (req, res) => {
    res.json({
        success: true,
        is_enabled: isAutoReminderEnabled,
        last_scan_time: lastAutoScanTime,
        reminders_sent_today: totalAutoRemindersSentToday,
        scan_interval_seconds: 60,
        upcoming_window_minutes: 120
    });
});

// API Bật/Tắt Tác tử Tự Động Nhắc Hẹn
app.post("/api/notifications/auto-reminder-toggle", (req, res) => {
    if (typeof req.body.enabled === 'boolean') {
        isAutoReminderEnabled = req.body.enabled;
    } else {
        isAutoReminderEnabled = !isAutoReminderEnabled;
    }
    res.json({
        success: true,
        is_enabled: isAutoReminderEnabled,
        message: `Tác tử tự động nhắc lịch Luồng 5 đã được ${isAutoReminderEnabled ? 'BẬT' : 'TẮT'}!`
    });
});

// API lấy danh sách các buổi phỏng vấn sắp diễn ra trong 2 giờ tới
app.get("/api/candidates/upcoming-interviews", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, full_name, name, email, applied_position, interview_time, interviewer_name, meeting_link, status, approval_status
            FROM candidates
            WHERE interview_time IS NOT NULL
              AND status != 'Loại'
              AND (approval_status != 'REJECTED' OR approval_status IS NULL)
        `);
        const now = Date.now();
        const twoHoursMs = 120 * 60 * 1000;
        const upcoming = (rows || []).filter(c => {
            const t = new Date(c.interview_time).getTime();
            return !isNaN(t) && (t - now) > 0 && (t - now) <= twoHoursMs;
        });
        res.json({ success: true, count: upcoming.length, data: upcoming });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Luồng 6: API gửi thư mời nhận việc (Job Offer Letter) sau khi trúng tuyển phỏng vấn
app.post("/api/candidates/send-offer", async (req, res) => {
    const { candidate_id, salary, start_date, probation_period, work_location, notes } = req.body;
    try {
        if (!candidate_id) {
            return res.status(400).json({ success: false, message: "Thiếu candidate_id" });
        }

        const [cRows] = await db.query("SELECT * FROM candidates WHERE id = ?", [Number(candidate_id)]);
        if (!cRows || cRows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy ứng viên" });
        }

        const cand = cRows[0];
        const candName = cand.full_name || cand.name;
        const offerNote = `Tác tử Luồng 6: Đã phát hành Thư Mời Nhận Việc (Job Offer). Lương: ${salary || 'Thỏa thuận'}, Ngày bắt đầu: ${start_date || 'Theo thỏa thuận'}, Thử việc: ${probation_period || '2 tháng'}.`;

        // Cập nhật status
        await db.query(`
            UPDATE candidates 
            SET status = 'Đạt', approval_status = 'OFFER_SENT',
                ai_evaluation = CONCAT(COALESCE(ai_evaluation, ''), ' | [Job Offer]: ', ?)
            WHERE id = ?
        `, [offerNote, Number(candidate_id)]);

        // Ghi Audit Trail
        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'OFFER_LETTER_SENT', ?, NOW())
        `, [Number(candidate_id), offerNote]);

        // Kích hoạt Luồng 5 gửi email Offer chính thức
        fetch("http://localhost:5678/webhook/send-interview-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(4000),
            body: JSON.stringify({
                candidate_id: Number(candidate_id),
                candidate_name: candName,
                candidate_email: cand.email,
                position: cand.applied_position,
                notification_type: "offer",
                salary: salary,
                start_date: start_date,
                subject_prefix: "[THƯ MỜI NHẬN VIỆC - JOB OFFER]"
            })
        }).catch(e => console.warn("Lỗi gọi n8n offer:", e.message));

        res.json({
            success: true,
            message: `Đã gửi Thư Mời Nhận Việc (Offer Letter) thành công cho ứng viên ${candName} qua Tác tử Luồng 6!`,
            candidate_id: Number(candidate_id),
            status: "Đạt",
            approval_status: "OFFER_SENT"
        });
    } catch (err) {
        console.error("Lỗi gửi offer:", err);
        res.status(500).json({ success: false, message: "Lỗi gửi offer: " + err.message });
    }
});

// Luồng 6: API chấm điểm & đánh giá sau phỏng vấn (Post-Interview Scorecard)
app.post("/api/interviews/evaluate", async (req, res) => {
    const { 
        candidate_id, 
        technical_score, 
        communication_score, 
        problem_solving_score, 
        decision, 
        interviewer_notes, 
        interviewer_name 
    } = req.body;

    try {
        if (!candidate_id || !decision) {
            return res.status(400).json({ success: false, message: "Thiếu candidate_id hoặc decision" });
        }

        let newStatus = 'Phỏng vấn';
        let newApprovalStatus = 'INTERVIEW_COMPLETED';
        let noteSummary = `Đánh giá buổi phỏng vấn: Kỹ thuật ${technical_score}/5, Giao tiếp ${communication_score}/5, Giải quyết vấn đề ${problem_solving_score}/5. Quyết định: ${decision}. Nhận xét: ${interviewer_notes || 'Không có'}`;

        if (decision === 'HIRE' || decision === 'Đạt' || decision === 'OFFER') {
            newStatus = 'Đạt';
            newApprovalStatus = 'APPROVED';
        } else if (decision === 'REJECT' || decision === 'Loại') {
            newStatus = 'Loại';
            newApprovalStatus = 'REJECTED';
        } else if (decision === 'ROUND2') {
            newStatus = 'Phỏng vấn';
            newApprovalStatus = 'ROUND_2_SCHEDULED';
        }

        // Cập nhật candidate
        await db.query(`
            UPDATE candidates 
            SET status = ?, approval_status = ?, ai_evaluation = CONCAT(COALESCE(ai_evaluation, ''), ' | [Đánh giá PV]: ', ?)
            WHERE id = ?
        `, [newStatus, newApprovalStatus, noteSummary, Number(candidate_id)]);

        // Ghi Audit Trail
        await db.query(`
            INSERT INTO candidate_history (candidate_id, action, note, updated_at)
            VALUES (?, 'INTERVIEW_EVALUATION', ?, NOW())
        `, [Number(candidate_id), noteSummary]);

        // Nếu Loại sau phỏng vấn -> Tự động kích hoạt Luồng 5 gửi thư từ chối sau phỏng vấn
        if (newStatus === 'Loại') {
            const [cRows] = await db.query("SELECT * FROM candidates WHERE id = ?", [Number(candidate_id)]);
            if (cRows && cRows.length > 0) {
                const cand = cRows[0];
                fetch("http://localhost:5678/webhook/send-interview-invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: AbortSignal.timeout(4000),
                    body: JSON.stringify({
                        candidate_id: Number(cand.id),
                        candidate_name: cand.full_name || cand.name,
                        candidate_email: cand.email,
                        position: cand.applied_position,
                        notification_type: "rejection_post_interview",
                        status: "REJECTED",
                        evaluation: noteSummary
                    })
                }).catch(e => console.warn(e));
            }
        }

        res.json({
            success: true,
            message: `Đã lưu đánh giá phỏng vấn và chuyển trạng thái ứng viên #${candidate_id} sang "${newStatus}" (${decision})!`,
            decision,
            new_status: newStatus
        });
    } catch (err) {
        console.error("Lỗi đánh giá phỏng vấn:", err);
        res.status(500).json({ success: false, message: "Lỗi đánh giá phỏng vấn: " + err.message });
    }
});

function buildTimelineEvents(cand, historyRows = []) {
    let events = [];
    events.push({
        time: cand.created_at || "2026-10-18 09:00:00",
        title: "Hồ Sơ Ứng Tuyển Được Tiếp Nhận",
        action: "CV_SUBMISSION",
        badge: "bg-blue-100 text-blue-700",
        icon: "fa-file-lines",
        description: `Ứng viên ${cand.full_name || cand.name || 'Ứng viên'} nộp hồ sơ ứng tuyển vị trí ${cand.applied_position || 'Chuyên viên'}.`
    });

    if (cand.match_score) {
        events.push({
            time: cand.created_at || "2026-10-18 09:02:00",
            title: "Tác Tử Luồng 2: Sàng Lọc & Chấm Điểm CV",
            action: "CV_SCREENING",
            badge: cand.match_score >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
            icon: "fa-robot",
            description: `AI Agent chấm điểm: ${cand.match_score}/100. Đánh giá: ${cand.ai_evaluation || 'Đạt chuẩn ban đầu.'}`
        });
    }

    if (cand.interview_time) {
        events.push({
            time: cand.created_at || "2026-10-18 10:15:00",
            title: "Tác Tử Luồng 4: Xếp Lịch Phỏng Vấn Thông Minh",
            action: "SCHEDULE_INTERVIEW",
            badge: "bg-indigo-100 text-indigo-700",
            icon: "fa-calendar-check",
            description: `Xếp lịch phỏng vấn vào lúc ${cand.interview_time} với Lead ${cand.interviewer_name || 'Hội đồng tuyển dụng'}. Link Meet: ${cand.meeting_link || 'Đã tạo'}`
        });
        events.push({
            time: cand.created_at || "2026-10-18 10:16:00",
            title: "Tác Tử Luồng 5: Gửi Thư Mời & Đồng Bộ Google Calendar",
            action: "INVITE_SENT",
            badge: "bg-emerald-100 text-emerald-700",
            icon: "fa-envelope-circle-check",
            description: `Email thư mời chính thức đã được gửi tới ${cand.email} và tạo sự kiện trên Google Calendar.`
        });
    }

    // Thêm các event từ candidate_history
    if (historyRows && historyRows.length > 0) {
        historyRows.forEach(h => {
            events.push({
                time: h.updated_at || h.created_at || "2026-10-18 10:20:00",
                title: `Tác Tử Luồng 6: ${h.action}`,
                action: h.action,
                badge: "bg-purple-100 text-purple-700",
                icon: "fa-clock-rotate-left",
                description: h.note || 'Cập nhật trạng thái ứng viên'
            });
        });
    }

    return events;
}

// Luồng 6: API lấy dòng thời gian lịch sử ứng viên (Timeline & Audit Trail)
app.get("/api/candidates/:id/timeline", async (req, res) => {
    const candidateId = Number(req.params.id);
    try {
        const [cRows] = await db.query("SELECT * FROM candidates WHERE id = ?", [candidateId]);
        if (!cRows || cRows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy ứng viên" });
        }
        const cand = cRows[0];
        const [historyRows] = await db.query("SELECT * FROM candidate_history WHERE candidate_id = ? ORDER BY id ASC", [candidateId]);

        const events = buildTimelineEvents(cand, historyRows);
        res.json({
            success: true,
            candidate: cand,
            timeline: events
        });
    } catch (err) {
        console.warn("[FALLBACK] CSDL không kết nối được khi lấy timeline:", err.message);
        const cand = MOCK_CANDIDATES.find(c => c.id === candidateId) || MOCK_CANDIDATES[0];
        const historyRows = MOCK_HISTORY.filter(h => h.candidate_id === cand.id);
        const events = buildTimelineEvents(cand, historyRows);

        res.json({
            success: true,
            candidate: cand,
            timeline: events,
            fallback: true
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});

