-- ========================================================
-- AI RECRUITMENT MULTI-AGENT SYSTEM - DATABASE INITIALIZATION
-- ========================================================

-- 1. Tạo Database
CREATE DATABASE IF NOT EXISTS `recruitment_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Cấp quyền & Tạo tài khoản user 'recruitment' cho localhost & docker remote
CREATE USER IF NOT EXISTS 'recruitment'@'localhost' IDENTIFIED BY 'recruitment123';
ALTER USER 'recruitment'@'localhost' IDENTIFIED BY 'recruitment123';
GRANT ALL PRIVILEGES ON `recruitment_db`.* TO 'recruitment'@'localhost';

CREATE USER IF NOT EXISTS 'recruitment'@'%' IDENTIFIED BY 'recruitment123';
ALTER USER 'recruitment'@'%' IDENTIFIED BY 'recruitment123';
GRANT ALL PRIVILEGES ON `recruitment_db`.* TO 'recruitment'@'%';

FLUSH PRIVILEGES;

USE `recruitment_db`;

-- 3. Bảng jobs (Quản lý tin tuyển dụng - Workflow 1)
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `position` VARCHAR(255) NOT NULL,
    `department` VARCHAR(255),
    `location` VARCHAR(255),
    `salary` VARCHAR(255),
    `requirements` TEXT,
    `job_description` LONGTEXT,
    `status` VARCHAR(50) DEFAULT 'published',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng candidates (Hồ sơ ứng viên - Workflow 2, 4, 5, 6)
CREATE TABLE IF NOT EXISTS `candidates` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `job_id` INT DEFAULT 1,
    `name` VARCHAR(255),
    `full_name` VARCHAR(255),
    `applied_position` VARCHAR(255),
    `email` VARCHAR(255),
    `cv_content` LONGTEXT,
    `match_score` DECIMAL(5,2) DEFAULT 0,
    `approval_status` VARCHAR(50),
    `status` VARCHAR(50) DEFAULT 'Chờ duyệt',
    `ai_evaluation` LONGTEXT,
    `interview_time` VARCHAR(255),
    `interviewer_name` VARCHAR(255),
    `meeting_link` VARCHAR(255),
    `notification_status` VARCHAR(50) DEFAULT 'Pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_job_id` (`job_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng workflow_logs (Nhật ký tự động hóa các luồng)
CREATE TABLE IF NOT EXISTS `workflow_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `workflow_name` VARCHAR(255),
    `execution_status` VARCHAR(50),
    `payload` LONGTEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng candidate_history (Lịch sử cập nhật trạng thái ứng viên)
CREATE TABLE IF NOT EXISTS `candidate_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `candidate_id` INT,
    `action` VARCHAR(100),
    `note` TEXT,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng recruitment_reports (Báo cáo tuyển dụng - Workflow 3)
CREATE TABLE IF NOT EXISTS `recruitment_reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `report_title` VARCHAR(255),
    `total_jobs` INT DEFAULT 0,
    `total_candidates` INT DEFAULT 0,
    `approved_candidates` INT DEFAULT 0,
    `rejected_candidates` INT DEFAULT 0,
    `avg_score` DECIMAL(5,2) DEFAULT 0,
    `ai_insights` LONGTEXT,
    `approval_status` VARCHAR(50) DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Thêm dữ liệu mẫu ban đầu cho tin tuyển dụng
INSERT INTO `jobs` (`id`, `position`, `department`, `location`, `salary`, `requirements`, `status`)
VALUES 
(1, 'Senior Backend Engineer', 'Engineering', 'Đà Nẵng', '35 - 50 Triệu VND', 'Node.js, Express, Docker, MySQL, n8n, Microservices', 'published'),
(2, 'Frontend Developer (React/Vue)', 'Engineering', 'Đà Nẵng', '18 - 28 Triệu VND', 'HTML5, CSS3, JavaScript ES6+, Bootstrap 5, RESTful API', 'published'),
(3, 'Chuyên viên Marketing', 'Truyền thông', 'Đà Nẵng', '15 - 20 Triệu VND', 'Content Marketing, SEO, Facebook Ads, Google Ads, sáng tạo nội dung', 'published'),
(4, 'Nhân viên Chăm sóc khách hàng', 'CSKH', 'Đà Nẵng', '8 - 12 Triệu VND', 'Kỹ năng giao tiếp xuất sắc, nhiệt tình, tin học văn phòng', 'published')
ON DUPLICATE KEY UPDATE `position`=`position`;

