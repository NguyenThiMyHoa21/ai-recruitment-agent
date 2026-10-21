/**
 * MOCK DATA CHO MÔI TRƯỜNG CLOUD HOSTING (RENDER / VERCEL)
 * Tự động kích hoạt khi không có kết nối CSDL MySQL cục bộ
 */

const MOCK_JOBS = [
    {
        id: 14,
        position: "Senior Backend Engineer",
        department: "Engineering",
        location: "TP. Hồ Chí Minh / Hybrid",
        salary: "35 - 50 Triệu VND",
        requirements: "3+ năm kinh nghiệm Node.js, Express, Docker, Microservices, RESTful API, n8n Automation.",
        job_description: "Phát triển hệ thống microservices và tích hợp các pipeline Agentic AI tự động hóa quy trình tuyển dụng.",
        status: "published"
    },
    {
        id: 8,
        position: "Frontend Developer",
        department: "Engineering",
        location: "Đà Nẵng / On-site",
        salary: "15 - 20 Triệu VND",
        requirements: "ReactJS, Tailwind CSS, TypeScript, RESTful API, thiết kế giao diện UI/UX hiện đại.",
        job_description: "Xây dựng cổng ứng viên và dashboard quản trị tuyển dụng thông minh cho bộ phận Nhân sự.",
        status: "published"
    },
    {
        id: 7,
        position: "DevOps Engineer",
        department: "Infrastructure",
        location: "Đà Nẵng / Remote",
        salary: "20 - 25 Triệu VND",
        requirements: "Docker, Kubernetes, CI/CD, Linux, AWS / Cloud Hosting, Giám sát hệ thống.",
        job_description: "Triển khai hạ tầng container hóa và tự động hóa quy trình CI/CD cho các tác tử AI.",
        status: "published"
    },
    {
        id: 12,
        position: "Kỹ sư Công nghệ thông tin",
        department: "IT",
        location: "Đà Nẵng",
        salary: "10 - 20 Triệu VND",
        requirements: "Phát triển phần mềm, quản trị mạng, hỗ trợ kỹ thuật và an toàn thông tin doanh nghiệp.",
        job_description: "Vận hành và phát triển các hệ thống phần mềm quản lý nội bộ trường VKU và đối tác.",
        status: "published"
    },
    {
        id: 28,
        position: "Chuyên viên Digital Marketing",
        department: "Truyền thông",
        location: "Đà Nẵng",
        salary: "15 - 22 Triệu VND",
        requirements: "Tối ưu chiến dịch Facebook Ads, Google Ads, sáng tạo Content Marketing, phân tích ROI.",
        job_description: "Quản lý các kênh truyền thông số và xây dựng chiến lược thương hiệu tuyển dụng trên đa nền tảng.",
        status: "published"
    },
    {
        id: 17,
        position: "Product Manager",
        department: "Product",
        location: "Hà Nội",
        salary: "25 - 35 Triệu VND",
        requirements: "Agile, Scrum, Product Roadmapping, Data Analysis, kỹ năng giao tiếp và lãnh đạo nhóm.",
        job_description: "Định hình tầm nhìn sản phẩm Agentic AI và phối hợp với các đội ngũ kỹ thuật để hiện thực hóa tính năng.",
        status: "published"
    },
    {
        id: 11,
        position: "Nhân viên kinh doanh",
        department: "Kinh doanh",
        location: "Đà Nẵng",
        salary: "8 - 12 Triệu VND",
        requirements: "Đàm phán thương lượng, tìm kiếm khách hàng, tư vấn dịch vụ và ký kết hợp đồng.",
        job_description: "Mở rộng mạng lưới đối tác doanh nghiệp và tư vấn các giải pháp chuyển đổi số thông minh.",
        status: "published"
    },
    {
        id: 13,
        position: "Nhân viên chăm sóc khách hàng",
        department: "CSKH",
        location: "Đà Nẵng",
        salary: "15 - 25 Triệu VND",
        requirements: "Giao tiếp tốt, xử lý tình huống linh hoạt, giọng nói truyền cảm và khả năng lắng nghe.",
        job_description: "Tiếp nhận và giải đáp các thắc mắc của ứng viên và khách hàng qua tổng đài và hệ thống đa kênh.",
        status: "published"
    },
    {
        id: 6,
        position: "Backend Developer",
        department: "Engineering",
        location: "Đà Nẵng",
        salary: "15 - 20 Triệu VND",
        requirements: "Node.js, Express, MySQL, RESTful API, Docker, kinh nghiệm làm việc theo mô hình MVC.",
        job_description: "Xây dựng các API backend phục vụ các tác tử AI và đồng bộ dữ liệu phỏng vấn.",
        status: "published"
    }
];

const MOCK_CANDIDATES = [
    {
        id: 4,
        job_id: 7,
        full_name: "Nguyễn Văn An",
        name: "Nguyễn Văn An",
        email: "nguyenvanan.dev@gmail.com",
        applied_position: "DevOps Engineer",
        position: "DevOps Engineer",
        match_score: 85,
        status: "Phỏng vấn",
        approval_status: "INTERVIEW_SCHEDULED",
        cv_content: "HỌ VÀ TÊN: Nguyễn Văn An\nEMAIL: nguyenvanan.dev@gmail.com\nVỊ TRÍ: DevOps Engineer\nKỸ NĂNG: Docker, Kubernetes, CI/CD Pipeline (GitHub Actions, GitLab CI), Linux Administration, Cloud Infrastructure (AWS, GCP), Terraform, Prometheus & Grafana.\nKINH NGHIỆM: 3+ năm làm việc tại môi trường Microservices, tối ưu thời gian deploy tự động và duy trì hệ thống uptime 99.9%.",
        cv_text: "HỌ VÀ TÊN: Nguyễn Văn An\nEMAIL: nguyenvanan.dev@gmail.com\nVỊ TRÍ: DevOps Engineer\nKỸ NĂNG: Docker, Kubernetes, CI/CD Pipeline (GitHub Actions, GitLab CI), Linux Administration, Cloud Infrastructure (AWS, GCP), Terraform, Prometheus & Grafana.\nKINH NGHIỆM: 3+ năm làm việc tại môi trường Microservices, tối ưu thời gian deploy tự động và duy trì hệ thống uptime 99.9%.",
        ai_evaluation: "Kinh nghiệm thực chiến Docker, Kubernetes vững vàng. Kỹ năng giao tiếp và tự động hóa CI/CD phù hợp tiêu chuẩn.",
        interview_time: "2026-10-22 09:30:00",
        interviewer_name: "Hội đồng Kỹ thuật DevOps",
        meeting_link: "https://meet.google.com/dfj-amei-jzt",
        created_at: "2026-10-18 08:30:00"
    },
    {
        id: 6,
        job_id: 11,
        full_name: "Nguyễn Thị Mỹ Hoa",
        name: "Nguyễn Thị Mỹ Hoa",
        email: "hoami2113@gmail.com",
        applied_position: "Nhân viên kinh doanh",
        position: "Nhân viên kinh doanh",
        match_score: 85,
        status: "Đạt",
        approval_status: "APPROVED",
        cv_content: "HỌ VÀ TÊN: Nguyễn Thị Mỹ Hoa\nEMAIL: hoami2113@gmail.com\nVỊ TRÍ: Nhân viên kinh doanh B2B / Solution Sales\nKỸ NĂNG: Đàm phán thương mại, thuyết trình giải pháp phần mềm, quản lý quan hệ khách hàng (CRM), phân tích nhu cầu doanh nghiệp.\nKINH NGHIỆM: 2+ năm kinh nghiệm phát triển mạng lưới đối tác công nghệ và mở rộng doanh số bán hàng trong ngành SaaS.",
        cv_text: "HỌ VÀ TÊN: Nguyễn Thị Mỹ Hoa\nEMAIL: hoami2113@gmail.com\nVỊ TRÍ: Nhân viên kinh doanh B2B / Solution Sales\nKỸ NĂNG: Đàm phán thương mại, thuyết trình giải pháp phần mềm, quản lý quan hệ khách hàng (CRM), phân tích nhu cầu doanh nghiệp.\nKINH NGHIỆM: 2+ năm kinh nghiệm phát triển mạng lưới đối tác công nghệ và mở rộng doanh số bán hàng trong ngành SaaS.",
        ai_evaluation: "Kỹ năng đàm phán và thuyết phục khách hàng tốt. Tác phong chuyên nghiệp, đáp ứng toàn diện tiêu chí sơ loại CV.",
        interview_time: null,
        interviewer_name: null,
        meeting_link: null,
        created_at: "2026-10-18 08:45:00"
    },
    {
        id: 8,
        job_id: 13,
        full_name: "Lê Thị Yến Nhi",
        name: "Lê Thị Yến Nhi",
        email: "nhilty@gmail.com",
        applied_position: "Nhân viên chăm sóc khách hàng",
        position: "Nhân viên chăm sóc khách hàng",
        match_score: 85,
        status: "Đạt",
        approval_status: "APPROVED",
        cv_content: "HỌ VÀ TÊN: Lê Thị Yến Nhi\nEMAIL: nhilty@gmail.com\nVỊ TRÍ: Nhân viên chăm sóc khách hàng (CSKH)\nKỸ NĂNG: Giao tiếp tiếng Việt chuẩn, xử lý khiếu nại khách hàng, trực tổng đài đa kênh (Zalo, Hotline, Email), sử dụng phần mềm hỗ trợ kỹ thuật.\nKINH NGHIỆM: 2 năm kinh nghiệm tư vấn khách hàng chu đáo và nhiệt tình.",
        cv_text: "HỌ VÀ TÊN: Lê Thị Yến Nhi\nEMAIL: nhilty@gmail.com\nVỊ TRÍ: Nhân viên chăm sóc khách hàng (CSKH)\nKỸ NĂNG: Giao tiếp tiếng Việt chuẩn, xử lý khiếu nại khách hàng, trực tổng đài đa kênh (Zalo, Hotline, Email), sử dụng phần mềm hỗ trợ kỹ thuật.\nKINH NGHIỆM: 2 năm kinh nghiệm tư vấn khách hàng chu đáo và nhiệt tình.",
        ai_evaluation: "Giọng nói chuẩn, phản ứng nhanh nhẹn, có chứng chỉ kỹ năng giao tiếp xuất sắc.",
        interview_time: null,
        interviewer_name: null,
        meeting_link: null,
        created_at: "2026-10-18 09:00:00"
    },
    {
        id: 23,
        job_id: 12,
        full_name: "Lê Nhi",
        name: "Lê Nhi",
        email: "nhilty.24it@vku.udn.vn",
        applied_position: "Kỹ sư Công nghệ thông tin",
        position: "Kỹ sư Công nghệ thông tin",
        match_score: 100,
        status: "Phỏng vấn",
        approval_status: "INTERVIEW_SCHEDULED",
        cv_content: "HỌ VÀ TÊN: Lê Nhi\nEMAIL: nhilty.24it@vku.udn.vn\nVỊ TRÍ: Kỹ sư Công nghệ thông tin\nKỸ NĂNG: Cấu trúc dữ liệu & Giải thuật, Kiến trúc phần mềm, Clean Code, RESTful API, Cơ sở dữ liệu quan hệ MySQL & PostgreSQL, n8n Agentic Workflow.\nKINH NGHIỆM: Đạt nhiều giải thưởng lập trình xuất sắc tại VKU, đồ án tốt nghiệp xuất sắc về hệ thống tự động hóa thông minh.",
        cv_text: "HỌ VÀ TÊN: Lê Nhi\nEMAIL: nhilty.24it@vku.udn.vn\nVỊ TRÍ: Kỹ sư Công nghệ thông tin\nKỸ NĂNG: Cấu trúc dữ liệu & Giải thuật, Kiến trúc phần mềm, Clean Code, RESTful API, Cơ sở dữ liệu quan hệ MySQL & PostgreSQL, n8n Agentic Workflow.\nKINH NGHIỆM: Đạt nhiều giải thưởng lập trình xuất sắc tại VKU, đồ án tốt nghiệp xuất sắc về hệ thống tự động hóa thông minh.",
        ai_evaluation: "Hồ sơ hoàn hảo, đáp ứng 100% yêu cầu về giải thuật, cấu trúc dữ liệu và phát triển phần mềm.",
        interview_time: "2026-10-22 14:00:00",
        interviewer_name: "Hội đồng Tuyển dụng IT",
        meeting_link: "https://meet.google.com/dfj-amei-jzt",
        created_at: "2026-10-18 09:15:00"
    },
    {
        id: 35,
        job_id: 12,
        full_name: "Lê Thị Ý",
        name: "Lê Thị Ý",
        email: "hoantm.24it@vku.udn.vn",
        applied_position: "Kỹ sư Công nghệ thông tin",
        position: "Kỹ sư Công nghệ thông tin",
        match_score: 82,
        status: "Phỏng vấn",
        approval_status: "INTERVIEW_SCHEDULED",
        cv_content: "HỌ VÀ TÊN: Lê Thị Ý\nEMAIL: hoantm.24it@vku.udn.vn\nVỊ TRÍ: Kỹ sư Công nghệ thông tin\nKỸ NĂNG: Java, Spring Boot, MySQL, Git, kiểm thử phần mềm tự động (Unit Test), quy trình Agile/Scrum.\nKINH NGHIỆM: Tham gia phát triển các dự án thực tế nội bộ và quản lý mã nguồn quy chuẩn.",
        cv_text: "HỌ VÀ TÊN: Lê Thị Ý\nEMAIL: hoantm.24it@vku.udn.vn\nVỊ TRÍ: Kỹ sư Công nghệ thông tin\nKỸ NĂNG: Java, Spring Boot, MySQL, Git, kiểm thử phần mềm tự động (Unit Test), quy trình Agile/Scrum.\nKINH NGHIỆM: Tham gia phát triển các dự án thực tế nội bộ và quản lý mã nguồn quy chuẩn.",
        ai_evaluation: "Nắm vững quy trình phát triển Agile, khả năng giải quyết vấn đề tốt.",
        interview_time: "2026-10-23 10:00:00",
        interviewer_name: "Hội đồng IT",
        meeting_link: "https://meet.google.com/dfj-amei-jzt",
        created_at: "2026-10-18 09:30:00"
    },
    {
        id: 45,
        job_id: 11,
        full_name: "Trần Văn Nam",
        name: "Trần Văn Nam",
        email: "nam.tran@example.com",
        applied_position: "Nhân viên kinh doanh",
        position: "Nhân viên kinh doanh",
        match_score: 17,
        status: "Loại",
        approval_status: "REJECTED",
        cv_content: "HỌ VÀ TÊN: Trần Văn Nam\nEMAIL: nam.tran@example.com\nVỊ TRÍ: Nhân viên kinh doanh\nKỸ NĂNG: Giao tiếp cơ bản, tin học văn phòng.\nKINH NGHIỆM: Chưa có kinh nghiệm thực tế trong lĩnh vực đàm phán hợp đồng thương mại.",
        cv_text: "HỌ VÀ TÊN: Trần Văn Nam\nEMAIL: nam.tran@example.com\nVỊ TRÍ: Nhân viên kinh doanh\nKỸ NĂNG: Giao tiếp cơ bản, tin học văn phòng.\nKINH NGHIỆM: Chưa có kinh nghiệm thực tế trong lĩnh vực đàm phán hợp đồng thương mại.",
        ai_evaluation: "CV chưa đáp ứng đủ yêu cầu kinh nghiệm tối thiểu trong lĩnh vực đàm phán và phát triển thị trường.",
        interview_time: null,
        interviewer_name: null,
        meeting_link: null,
        created_at: "2026-10-18 09:45:00"
    },
    {
        id: 63,
        job_id: 28,
        full_name: "Võ Công Chính",
        name: "Võ Công Chính",
        email: "chinh.vo@example.com",
        applied_position: "Chuyên viên Digital Marketing",
        position: "Chuyên viên Digital Marketing",
        match_score: 78,
        status: "Đạt",
        approval_status: "APPROVED",
        cv_content: "HỌ VÀ TÊN: Võ Công Chính\nEMAIL: chinh.vo@example.com\nVỊ TRÍ: Chuyên viên Digital Marketing\nKỸ NĂNG: Quản trị chiến dịch Facebook Ads, Google Ads, SEO Onpage/Offpage, phân tích Google Analytics, tính toán chỉ số ROI/CPA.\nKINH NGHIỆM: 2 năm thực chiến tối ưu hóa chi phí quảng cáo cho các chiến dịch ra mắt sản phẩm mới.",
        cv_text: "HỌ VÀ TÊN: Võ Công Chính\nEMAIL: chinh.vo@example.com\nVỊ TRÍ: Chuyên viên Digital Marketing\nKỸ NĂNG: Quản trị chiến dịch Facebook Ads, Google Ads, SEO Onpage/Offpage, phân tích Google Analytics, tính toán chỉ số ROI/CPA.\nKINH NGHIỆM: 2 năm thực chiến tối ưu hóa chi phí quảng cáo cho các chiến dịch ra mắt sản phẩm mới.",
        ai_evaluation: "Có kinh nghiệm chạy quảng cáo số và đo lường ROI chuyển đổi hiệu quả.",
        interview_time: null,
        interviewer_name: null,
        meeting_link: null,
        created_at: "2026-10-18 10:00:00"
    }
];

const MOCK_HISTORY = [
    {
        candidate_id: 4,
        candidate_name: "Nguyễn Văn An",
        action: "INTERVIEW_SCHEDULED",
        note: "Tác tử Luồng 4: Đã xếp lịch phỏng vấn lúc 2026-10-21 09:30:00",
        created_at: "2026-10-18 10:15:00"
    },
    {
        candidate_id: 23,
        candidate_name: "Lê Nhi",
        action: "INTERVIEW_INVITE_SENT",
        note: "Tác tử Luồng 5: Đã gửi thư mời phỏng vấn & tạo sự kiện Google Calendar",
        created_at: "2026-10-18 10:20:00"
    },
    {
        candidate_id: 6,
        candidate_name: "Nguyễn Thị Mỹ Hoa",
        action: "CV_SCREENING_PASSED",
        note: "Tác tử Luồng 2: Sơ loại hồ sơ ĐẠT (Điểm: 85/100)",
        created_at: "2026-10-18 10:25:00"
    }
];

const MOCK_REPORT = {
    totalCandidates: 52,
    passedCount: 28,
    interviewCount: 16,
    rejectedCount: 8,
    passRate: 84.6,
    avgScore: 78.4,
    scoreDistribution: [
        { range: "0 - 49 (Loại)", count: 8 },
        { range: "50 - 69 (Tiềm năng)", count: 12 },
        { range: "70 - 84 (Đạt)", count: 20 },
        { range: "85 - 100 (Xuất sắc)", count: 12 }
    ]
};

module.exports = {
    MOCK_JOBS,
    MOCK_CANDIDATES,
    MOCK_HISTORY,
    MOCK_REPORT
};

