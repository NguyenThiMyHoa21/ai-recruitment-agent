require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ giao diện tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối cơ sở dữ liệu MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// 1. API: Lấy danh sách ứng viên từ MySQL
app.get('/api/candidates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Lỗi MySQL:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn Database' });
  }
});

// 2. API: Gửi đổi trạng thái sang n8n Webhook
app.post('/api/candidates/update-status', async (req, res) => {
  const { id, full_name, applied_position, new_status } = req.body;

  if (!id || !new_status) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    const n8nRes = await axios.post(process.env.N8N_WEBHOOK_URL, {
      candidate_id: id,
      full_name,
      applied_position,
      new_status
    });

    res.json({
      success: true,
      message: 'Cập nhật thành công',
      data: n8nRes.data
    });
  } catch (err) {
    console.error('Lỗi gọi n8n:', err.message);
    res.status(502).json({
      success: false,
      message: 'Không thể kết nối đến n8n workflow',
      error: err.message
    });
  }
});
// Route API xếp lịch phỏng vấn qua Luồng 4 n8n
app.post('/api/schedule-interview', async (req, res) => {
  const { candidate_id, requested_by } = req.body;
  try {
    const n8nUrl = 'http://localhost:5678/webhook/interview-schedule';
    const response = await axios.post(n8nUrl, {
      candidate_id: candidate_id,
      requested_by: requested_by || 'HR_Web_Admin'
    });
    res.json(response.data);
  } catch (error) {
    console.error('Lỗi gọi Luồng 4 n8n:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi xếp lịch phỏng vấn qua n8n' });
  }
});
// API Luồng 5: Kích hoạt gửi thư mời & nhắc lịch qua n8n
app.post('/api/candidates/:id/send-invite', async (req, res) => {
    try {
        const candidateId = req.params.id;
        const [rows] = await pool.query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ứng viên' });
        }

        const candidate = rows[0];
        const n8nWebhookUrl = 'http://localhost:5678/webhook/send-interview-invite';

        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidate_name: candidate.name,
                candidate_email: candidate.email,
                position: candidate.position,
                interview_time: candidate.interview_time || '09:30 02/10/2026',
                interviewer: candidate.interviewer || 'Trần Văn Tech',
                meet_link: candidate.meet_link || 'https://meet.google.com/abc-defg-hij'
            })
        });

        const data = await response.json();
        return res.json({ success: true, data });
    } catch (err) {
        console.error('Lỗi khi kích hoạt Luồng 5:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend đang chạy tại: http://localhost:${PORT}`);
});
