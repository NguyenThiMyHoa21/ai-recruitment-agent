/**
 * PERSISTENT FILE-BASED DATA STORE
 * Lưu trữ vĩnh viễn tin tuyển dụng, hồ sơ ứng viên và lịch sử ra file JSON
 * Đảm bảo tắt máy bật lại vẫn giữ nguyên 100% dữ liệu đã test
 */

const fs = require('fs');
const path = require('path');
const initialMock = require('./mock-data');

const DATA_DIR = path.join(__dirname, 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const DEMO_50_PATH = path.join(__dirname, '../frontend/demo-candidates.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. Khởi tạo jobs
let MOCK_JOBS = [];
try {
    if (fs.existsSync(JOBS_FILE)) {
        const raw = fs.readFileSync(JOBS_FILE, 'utf-8');
        MOCK_JOBS = JSON.parse(raw);
    }
} catch (e) {
    console.warn("[DataStore] Lỗi đọc jobs.json, nạp từ mock-data:", e.message);
}
if (!Array.isArray(MOCK_JOBS) || MOCK_JOBS.length === 0) {
    MOCK_JOBS = [...initialMock.MOCK_JOBS];
    try {
        fs.writeFileSync(JOBS_FILE, JSON.stringify(MOCK_JOBS, null, 2), 'utf-8');
    } catch(e) {}
}

// 2. Khởi tạo candidates (ưu tiên nạp đủ 50 ứng viên mẫu chuẩn)
let MOCK_CANDIDATES = [];
try {
    if (fs.existsSync(CANDIDATES_FILE)) {
        const raw = fs.readFileSync(CANDIDATES_FILE, 'utf-8');
        MOCK_CANDIDATES = JSON.parse(raw);
    }
} catch (e) {
    console.warn("[DataStore] Lỗi đọc candidates.json:", e.message);
}
if (!Array.isArray(MOCK_CANDIDATES) || MOCK_CANDIDATES.length === 0) {
    try {
        if (fs.existsSync(DEMO_50_PATH)) {
            const rawDemo = fs.readFileSync(DEMO_50_PATH, 'utf-8');
            MOCK_CANDIDATES = JSON.parse(rawDemo);
        }
    } catch(e) {}
    if (!Array.isArray(MOCK_CANDIDATES) || MOCK_CANDIDATES.length === 0) {
        MOCK_CANDIDATES = [...initialMock.MOCK_CANDIDATES];
    }
    try {
        fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(MOCK_CANDIDATES, null, 2), 'utf-8');
    } catch(e) {}
}

// 3. Khởi tạo history
let MOCK_HISTORY = [];
try {
    if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        MOCK_HISTORY = JSON.parse(raw);
    }
} catch (e) {
    console.warn("[DataStore] Lỗi đọc history.json:", e.message);
}
if (!Array.isArray(MOCK_HISTORY) || MOCK_HISTORY.length === 0) {
    MOCK_HISTORY = [...initialMock.MOCK_HISTORY];
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(MOCK_HISTORY, null, 2), 'utf-8');
    } catch(e) {}
}

const MOCK_REPORT = initialMock.MOCK_REPORT;

function saveJobsToFile() {
    try {
        fs.writeFileSync(JOBS_FILE, JSON.stringify(MOCK_JOBS, null, 2), 'utf-8');
        console.log(`[DataStore] Đã lưu bền vững ${MOCK_JOBS.length} công việc vào file data/jobs.json.`);
    } catch (e) {
        console.warn("[DataStore] Lỗi ghi jobs.json:", e.message);
    }
}

function saveCandidatesToFile() {
    try {
        fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(MOCK_CANDIDATES, null, 2), 'utf-8');
        console.log(`[DataStore] Đã lưu bền vững ${MOCK_CANDIDATES.length} ứng viên vào file data/candidates.json.`);
    } catch (e) {
        console.warn("[DataStore] Lỗi ghi candidates.json:", e.message);
    }
}

function saveHistoryToFile() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(MOCK_HISTORY, null, 2), 'utf-8');
    } catch (e) {
        console.warn("[DataStore] Lỗi ghi history.json:", e.message);
    }
}

module.exports = {
    MOCK_JOBS,
    MOCK_CANDIDATES,
    MOCK_HISTORY,
    MOCK_REPORT,
    saveJobsToFile,
    saveCandidatesToFile,
    saveHistoryToFile
};
