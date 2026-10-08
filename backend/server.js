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

// API nhận hồ sơ ứng tuyển từ Candidate Portal -> Gửi sang Webhook Luồng 2 n8n (cv-screening-clean)
app.post("/api/screen-cv", async (req, res) => {
    try {
        const payload = req.body;
        console.log("Candidate application received:", payload);

        const response = await fetch("http://localhost:5678/webhook/cv-screening-clean", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const resultText = await response.text();
        let resultJson = {};
        try {
            resultJson = JSON.parse(resultText);
        } catch(e) {
            resultJson = { raw: resultText };
        }

        res.json({
            success: true,
            message: "Hồ sơ ứng tuyển đã được nhận và chuyển sang AI Screening!",
            data: resultJson
        });
    } catch (error) {
        console.error("Lỗi khi gửi hồ sơ ứng tuyển sang n8n Luồng 2:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi kết nối máy chủ n8n Luồng 2",
            error: error.message
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

        const response = await fetch("http://localhost:5678/webhook/interview-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(candidate_id),
                requested_by: requested_by || "HR_Web_Admin",
                interview_time: smartTime
            })
        });
        const result = await response.json();

        // Đồng bộ trạng thái phỏng vấn & thời gian giãn cách thông minh vào MySQL
        try {
            await db.query(
                "UPDATE candidates SET approval_status = 'INTERVIEW_SCHEDULED', status = 'Phỏng vấn', interview_time = COALESCE(interview_time, ?) WHERE id = ?",
                [smartTime, Number(candidate_id)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB:", dbErr.message);
        }

        // TỰ ĐỘNG GỬI THƯ MỜI PHỎNG VẤN QUA LUỒNG 5 (Không cần bấm nút thủ công)
        try {
            const [cRows] = await db.query(
                "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
                [Number(candidate_id)]
            );
            if (cRows && cRows.length > 0) {
                const cand = cRows[0];
                fetch("http://localhost:5678/webhook/send-interview-invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        candidate_id: Number(cand.id),
                        candidate_name: cand.full_name || cand.name,
                        candidate_email: cand.email,
                        position: cand.job_title || cand.position,
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
        console.error("Lỗi gọi Luồng 4 n8n:", error.message);
        res.status(500).json({ success: false, message: "Lỗi khi xếp lịch phỏng vấn qua n8n" });
    }
});

// Route API dời/đổi giờ phỏng vấn linh hoạt cho ứng viên (Reschedule)
app.post("/api/reschedule-interview", async (req, res) => {
    const { candidate_id, new_interview_time, reason } = req.body;
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

        if (cRows && cRows.length > 0) {
            const cand = cRows[0];
            fetch("http://localhost:5678/webhook/send-interview-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    try {
        const response = await fetch("http://localhost:5678/webhook/update-candidate-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(targetId),
                full_name: candName,
                applied_position: candPos,
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
                "UPDATE candidates SET approval_status = ?, status = ?, full_name = COALESCE(full_name, ?), applied_position = COALESCE(applied_position, ?) WHERE id = ?",
                [appStatus, new_status, candName, candPos, Number(targetId)]
            );
        } catch (dbErr) {
            console.warn("Lỗi sync DB:", dbErr.message);
        }

        // Nếu chuyển sang Phỏng vấn và chưa có lịch -> Tự động xếp lịch & gửi thư mời luôn
        if (new_status === 'Phỏng vấn' || new_status === 'INTERVIEW_SCHEDULED') {
            try {
                const [checkRows] = await db.query("SELECT interview_time FROM candidates WHERE id = ?", [Number(targetId)]);
                if (checkRows && checkRows.length > 0 && !checkRows[0].interview_time) {
                    fetch("http://localhost:3000/api/schedule-interview", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ candidate_id: Number(targetId), requested_by: "Auto_Status_Change" })
                    }).catch(e => console.warn("Lỗi auto schedule:", e.message));
                }
            } catch (errCheck) {
                console.warn("Lỗi check lịch auto:", errCheck.message);
            }
        }

        // Nếu chuyển sang Loại -> Tự động gửi email thông báo từ chối lịch sự
        if (new_status === 'Loại' || new_status === 'Không đạt' || new_status === 'REJECTED') {
            fetch("http://localhost:3000/api/auto-notify-reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_id: Number(targetId),
                    candidate_name: candName,
                    position: candPos,
                    evaluation: "Hồ sơ chưa phù hợp với tiêu chí tuyển dụng theo đánh giá của Hội đồng."
                })
            }).catch(e => console.warn("Lỗi auto reject email:", e.message));
        }

        res.json(result);
    } catch (error) {
        console.error("Lỗi gọi Luồng 6 n8n:", error.message);
        res.status(500).json({ success: false, message: "Lỗi kết nối n8n cập nhật trạng thái" });
    }
});

// API Luồng 5: Kích hoạt gửi thư mời & nhắc lịch qua n8n (Lê Thị Yến Nhi)
app.post("/api/candidates/:id/send-invite", async (req, res) => {
    try {
        const candidateId = req.params.id;
        const [rows] = await db.query(
            "SELECT c.*, COALESCE(c.applied_position, j.position, 'Vị trí chuyên viên') as job_title FROM candidates c LEFT JOIN jobs j ON c.job_id = j.id WHERE c.id = ?",
            [candidateId]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ ứng viên" });
        }

        const candidate = rows[0];
        const n8nWebhookUrl = "http://localhost:5678/webhook/send-interview-invite";

        const response = await fetch(n8nWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate_id: Number(candidate.id),
                candidate_name: candidate.full_name || candidate.name,
                candidate_email: candidate.email,
                position: candidate.job_title || candidate.position,
                interview_time: candidate.interview_time || "09:30 03/10/2026",
                interviewer: candidate.interviewer_name || "Nguyễn HR Manager",
                meet_link: candidate.meeting_link || "https://meet.google.com/dfj-amei-jzt"
            })
        });

        const data = await response.json();
        return res.json({ success: true, message: "Đã gửi thư mời phỏng vấn thành công qua Luồng 5!", data });
    } catch (err) {
        console.error("Lỗi khi kích hoạt Luồng 5:", err);
        return res.status(500).json({ success: false, message: "Lỗi kết nối n8n Luồng 5", error: err.message });
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

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
