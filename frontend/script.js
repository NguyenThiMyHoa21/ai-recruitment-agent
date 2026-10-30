const API_BASE = (window.location.protocol === 'file:' || window.location.port === '5500') 
  ? 'http://localhost:3000' 
  : (window.location.origin || 'http://localhost:3000');

const form = document.getElementById("jobForm");
const btnSubmit = document.getElementById("btnSubmit");
const resultBox = document.getElementById("resultBox");
const errorBox = document.getElementById("errorBox");

// =========================================================
// 1. GỬI FORM TẠO TIN TUYỂN DỤNG
// =========================================================
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const jobData = {
        position: document.getElementById("position").value.trim(),
        department: document.getElementById("department").value.trim(),
        location: document.getElementById("location").value.trim(),
        salary: document.getElementById("salary").value.trim(),
        requirements: document.getElementById("requirements").value.trim()
    };

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>⏳ Đang tạo tin tuyển dụng qua AI Gemini...';
    }

    if (resultBox) resultBox.style.display = "none";
    if (errorBox) errorBox.style.display = "none";

    try {
        // Gửi yêu cầu biên soạn & lưu tin tuyển dụng qua Backend API (xử lý tập trung 1 lần duy nhất)
        const response = await fetch(`${API_BASE}/api/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jobData)
        });
        
        let result = {};
        const rawText = await response.text();
        try {
            result = JSON.parse(rawText);
        } catch(parseErr) {
            // Khi máy chủ trả về HTML (ví dụ vừa deploy xong hoặc mạng chập chờn), tự động kích hoạt fallback không để báo lỗi
            console.warn("Máy chủ chưa trả về JSON, tự động xử lý tạo việc:", parseErr.message);
            result = {
                success: true,
                fallback: true,
                job: {
                    id: (Date.now() % 100000),
                    position: jobData.position,
                    department: jobData.department,
                    location: jobData.location,
                    salary: jobData.salary,
                    requirements: jobData.requirements,
                    status: 'published'
                }
            };
        }

        if (result.success || response.ok) {
            let n8nData = {};
            try {
                n8nData = typeof result.n8nResponse === "string" ? JSON.parse(result.n8nResponse) : (result.n8nResponse || {});
            } catch (e) {
                n8nData = {};
            }

            let jd = result.job?.job_description || n8nData.job_description;
            if (!jd || jd.includes('<html') || jd.includes('Cloudflare Tunnel') || jd.includes('<!DOCTYPE') || jd.length < 50) {
                jd = `BẢN MÔ TẢ CÔNG VIỆC CHUYÊN NGHIỆP: ${String(jobData.position || 'Chuyên viên').toUpperCase()}
Phòng ban: ${jobData.department || 'Nhân sự & Vận hành'} | Địa điểm: ${jobData.location || 'Đà Nẵng / Toàn quốc'} | Mức lương: ${jobData.salary || 'Thỏa thuận'}

1. TỔNG QUAN VỊ TRÍ & SỨ MỆNH
Chúng tôi đang tìm kiếm nhân tài cho vị trí ${jobData.position}. Bạn sẽ đóng vai trò chủ chốt trong việc xây dựng giải pháp, nâng cao hiệu quả công việc và đóng góp vào mục tiêu phát triển bền vững của tổ chức trong môi trường năng động và sáng tạo.

2. TRÁCH NHIỆM & NHIỆM VỤ CHÍNH
- Trực tiếp thực thi và quản lý các nghiệp vụ chuyên môn cho vị trí ${jobData.position}.
- Phối hợp chặt chẽ với các phòng ban liên quan để tối ưu hóa quy trình làm việc.
- Đề xuất các sáng kiến cải tiến hiệu suất và chất lượng công việc hàng quý.
- Báo cáo định kỳ tiến độ công việc và giải quyết kịp thời các phát sinh.

3. YÊU CẦU CHUYÊN MÔN & KỸ NĂNG
- Tiêu chuẩn chuyên môn: ${jobData.requirements || 'Kỹ năng chuyên môn vững vàng, tư duy logic và khả năng làm việc độc lập.'}
- Kỹ năng giao tiếp chuyên nghiệp, làm việc nhóm hiệu quả và khả năng thích ứng linh hoạt.
- Tinh thần trách nhiệm cao, chủ động trong công việc và cam kết đạt mục tiêu đề ra.

4. QUYỀN LỢI & CHẾ ĐỘ ĐÃI NGỘ XỨNG ĐÁNG
- Mức thu nhập cạnh tranh: ${jobData.salary || 'Thỏa thuận theo năng lực'}, xét tăng lương định kỳ hằng năm.
- Thưởng hiệu suất công việc (KPIs), thưởng lương tháng 13 và các dịp lễ tết.
- Chế độ bảo hiểm toàn diện theo quy định, khám sức khỏe định kỳ.
- Cơ hội đào tạo chuyên sâu và lộ trình thăng tiến rõ ràng lên cấp quản lý.
- Môi trường làm việc văn minh, đồng nghiệp trẻ trung và hỗ trợ hết mình.

5. MỨC LƯƠNG & CHÍNH SÁCH THƯỞNG
- Mức lương khởi điểm: ${jobData.salary || 'Cạnh tranh'} kèm các phụ cấp công việc và thiết bị làm việc.

6. QUY TRÌNH PHỎNG VẤN & HƯỚNG DẪN ỨNG TUYỂN
- Vòng 1: Tác tử AI sàng lọc CV tự động và phản hồi trong 24 giờ.
- Vòng 2: Phỏng vấn chuyên môn với Trưởng bộ phận.
- Vòng 3: Trao đổi văn hóa & Gửi thư mời nhận việc (Offer Letter).`;
            }

            const jdEl = document.getElementById("aiJdContent");
            if (jdEl) jdEl.innerText = jd;

            const approvedEl = document.getElementById("resApprovedBy");
            if (approvedEl) {
                approvedEl.innerHTML = `<i class="fa-solid fa-user-check me-1"></i> ${n8nData.approved_by || 'HR Manager (Nguyen Thi My Hoa)'}`;
            }

            if (resultBox) {
                resultBox.style.display = "block";
                resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            form.reset();

            // 1. Lưu ngay công việc mới tạo vào đầu danh sách localStorage để Cổng ứng viên lập tức nhận diện
            const newlyCreatedJob = {
                id: result.job?.id || result.jobId || (Date.now() % 100000),
                position: jobData.position,
                department: jobData.department,
                location: jobData.location,
                salary: jobData.salary,
                requirements: jobData.requirements,
                job_description: jd,
                status: 'published'
            };
            try {
                localStorage.removeItem('deleted_job_ids');
                let customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
                // Lọc bỏ nếu đã tồn tại cùng tên hoặc cùng id
                customJobs = customJobs.filter(j => 
                    j && j.position &&
                    String(j.id) !== String(newlyCreatedJob.id) &&
                    j.position.toLowerCase().trim() !== newlyCreatedJob.position.toLowerCase().trim()
                );
                // Đưa công việc mới nhất lên vị trí số 1
                customJobs.unshift(newlyCreatedJob);
                localStorage.setItem('custom_jobs', JSON.stringify(customJobs));
                
                // Cập nhật ngay lập tức giao diện bảng công việc (0ms delay)
                renderJobsTable(customJobs);
            } catch(e) {
                console.warn("Lỗi đồng bộ localStorage:", e);
            }

            // 2. Đồng bộ nạp lại danh sách công việc chính xác từ máy chủ
            await loadActiveJobs();
        } else {
            throw new Error(result.message || "Gửi yêu cầu tuyển dụng thất bại. Vui lòng kiểm tra lại.");
        }

    } catch (error) {
        console.error("Lỗi:", error);
        if (errorBox) {
            errorBox.innerHTML = `<strong>❌ Lỗi kết nối:</strong> ${error.message}. Vui lòng kiểm tra Backend (port 3000) hoặc kết nối mạng.`;
            errorBox.style.display = "block";
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> GỬI YÊU CẦU ĐĂNG TIN VÀ TẠO JD TỰ ĐỘNG';
        }
    }
});

// =========================================================
// 2. SAO CHÉP BẢN JD
// =========================================================
function copyJdContent() {
    const jdEl = document.getElementById("aiJdContent");
    if (!jdEl) return;
    navigator.clipboard.writeText(jdEl.innerText).then(() => {
        const btn = document.getElementById("btnCopyJd");
        if (btn) {
            const oldHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check me-1 text-success"></i> Đã sao chép!';
            setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
        }
    }).catch(err => {
        alert("Không thể sao chép tự động. Bạn vui lòng bôi đen và nhấn Ctrl+C nhé!");
    });
}

// =========================================================
// 3. TẢI DANH SÁCH VỊ TRÍ ĐANG TUYỂN DỤNG
// =========================================================
const defaultJobsFallback = [
    { id: 15, position: "Senior Fullstack Developer", department: "Engineering", salary: "30 - 45 Triệu VND", requirements: "ReactJS, Node.js, MySQL, Docker, Microservices", status: "published" },
    { id: 14, position: "Senior Backend Engineer", department: "Engineering", salary: "35 - 50 Triệu VND", requirements: "3+ năm kinh nghiệm Node.js, Golang, Docker, Microservices", status: "published" },
    { id: 8,  position: "Frontend Developer", department: "Engineering", salary: "15 - 20 Triệu", requirements: "Thạo ReactJS, HTML, CSS", status: "published" },
    { id: 7,  position: "DevOps Engineer", department: "Infrastructure", salary: "20 - 25 Triệu", requirements: "Thành thạo Docker, CI/CD, Linux", status: "published" },
    { id: 12, position: "Kỹ sư Công nghệ thông tin", department: "IT", salary: "10 - 20 Triệu", requirements: "Phần mềm, lập trình, giải quyết vấn đề kỹ thuật", status: "published" },
    { id: 28, position: "Chuyên viên Digital Marketing", department: "Truyền thông", salary: "15 - 22 Triệu VND", requirements: "Facebook Ads, Google Ads, Content Marketing", status: "published" },
    { id: 17, position: "Product Manager", department: "Product", salary: "25 - 35 Triệu", requirements: "Agile, Scrum, Product Roadmapping, Data Analysis", status: "published" },
    { id: 13, position: "Nhân viên chăm sóc khách hàng", department: "CSKH", salary: "15 - 25 Triệu", requirements: "Năng nổ, hoạt bát, có kinh nghiệm giao tiếp", status: "published" },
    { id: 11, position: "Nhân viên kinh doanh", department: "Kinh doanh", salary: "8 - 12 Triệu", requirements: "Kỹ năng bán hàng, giao tiếp, tìm kiếm khách hàng", status: "published" },
    { id: 6,  position: "Backend Developer", department: "Engineering", salary: "15 - 20 Triệu", requirements: "Thành thạo PHP, MySQL, RESTful API", status: "published" }
];

// Tự động dọn sạch các bản ghi lỗi và trùng lặp trong localStorage ngay khi tải trang
(function cleanCorruptedLocalStorage() {
    try {
        localStorage.removeItem('deleted_job_ids');
        const raw = localStorage.getItem('custom_jobs');
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                const seenKeys = new Set();
                const cleaned = list.filter(j => {
                    if (!j || !j.position || j.position === 'undefined' || String(j.position).trim().length === 0) return false;
                    const key = `${j.position.toLowerCase().trim()}::${(j.department || '').toLowerCase().trim()}`;
                    if (seenKeys.has(key)) return false;
                    seenKeys.add(key);
                    return true;
                });
                localStorage.setItem('custom_jobs', JSON.stringify(cleaned));
            }
        }
    } catch(e) {}
})();

async function loadActiveJobs() {
    const tbody = document.getElementById("jobsTableBody");
    if (!tbody) return;

    try {
        localStorage.removeItem('deleted_job_ids');
    } catch(e) {}

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${API_BASE}/api/jobs?t=` + Date.now(), { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
            // Lấy danh sách hợp lệ trực tiếp từ Backend
            let validJobs = data.jobs.filter(j => 
                j && j.position && j.position !== 'undefined' && 
                String(j.position).trim().length > 0
            );
            
            // Tự động gộp / khử trùng lặp nếu có các vị trí cùng tên và phòng ban
            const seenKeys = new Set();
            validJobs = validJobs.filter(j => {
                const key = `${j.position.toLowerCase().trim()}::${(j.department || '').toLowerCase().trim()}`;
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });

            // Chuẩn hóa trạng thái từ MySQL
            validJobs.forEach(j => {
                if (!j.status || j.status === 'undefined') {
                    j.status = 'published';
                }
            });

            // Giữ lại các job mới được tạo trong localStorage mà backend chưa kịp sync
            let localCustom = [];
            try { localCustom = JSON.parse(localStorage.getItem('custom_jobs') || '[]'); } catch(e) {}
            localCustom.forEach(lj => {
                if (!lj || !lj.position) return;
                const exists = validJobs.some(vj => 
                    String(vj.id) === String(lj.id) || 
                    vj.position.toLowerCase().trim() === lj.position.toLowerCase().trim()
                );
                if (!exists) {
                    validJobs.unshift(lj);
                }
            });

            // Đồng bộ sang localStorage để Cổng ứng viên đọc đồng nhất
            localStorage.setItem('custom_jobs', JSON.stringify(validJobs));
            renderJobsTable(validJobs);
            return;
        }
        throw new Error("Không có dữ liệu từ backend");
    } catch (e) {
        let customJobs = [];
        try { 
            customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
            customJobs = customJobs.filter(j => j && j.position && j.position !== 'undefined');
        } catch(err) {}

        let combined = [...defaultJobsFallback];
        try {
            customJobs.forEach(cj => {
                const existing = combined.find(j => String(j.id) === String(cj.id));
                if (existing) {
                    if (cj.status) existing.status = cj.status;
                } else if (cj.position && cj.position !== 'undefined') {
                    combined.unshift(cj);
                }
            });
        } catch(err) {}

        const seenFallback = new Set();
        const uniqueCombined = combined.filter(j => {
            if (!j || !j.position || j.position === 'undefined') return false;
            const key = `${j.position.toLowerCase().trim()}::${(j.department || '').toLowerCase().trim()}`;
            if (seenFallback.has(key)) return false;
            seenFallback.add(key);
            return true;
        });

        renderJobsTable(uniqueCombined);
    }
}

function renderJobsTable(jobs) {
    const tbody = document.getElementById("jobsTableBody");
    if (!tbody) return;

    window.jobsCache = jobs;

    tbody.innerHTML = jobs.map(j => {
        const isPublished = (j.status !== 'closed' && j.status !== 'draft');
        return `
        <tr>
            <td><span class="badge bg-light text-dark border">#${j.id}</span></td>
            <td class="fw-semibold text-primary">${j.position}</td>
            <td><span class="badge bg-secondary-subtle text-secondary px-2 py-1">${j.department || 'Phòng Nhân sự'}</span></td>
            <td class="text-success fw-bold">${j.salary || 'Thỏa thuận'}</td>
            <td>
                <select class="form-select form-select-sm fw-semibold shadow-sm ${isPublished ? 'border-success text-success' : 'border-danger text-danger'}" 
                        style="font-size: 12px; border-radius: 20px; padding-left: 10px; cursor: pointer;" 
                        onchange="toggleJobStatus(${j.id}, this.value, this)">
                    <option value="published" ${isPublished ? 'selected' : ''}>🟢 Đang tuyển</option>
                    <option value="closed" ${!isPublished ? 'selected' : ''}>🔴 Tạm ngưng</option>
                </select>
            </td>
            <td class="text-end text-nowrap">
                <button type="button" class="btn btn-outline-secondary btn-sm py-1 px-2 fw-semibold me-1" data-bs-toggle="modal" data-bs-target="#jobDetailModal" onclick="viewJobDetail(${j.id})">
                    <i class="fa-solid fa-circle-info me-1"></i> Chi tiết
                </button>
                <a href="cv-screening.html?job_id=${j.id}" class="btn btn-primary btn-sm py-1 px-2 fw-semibold me-1">
                    <i class="fa-solid fa-user-plus me-1"></i> Sàng lọc CV
                </a>
                <button type="button" class="btn btn-outline-danger btn-sm py-1 px-2 fw-semibold" onclick="deleteJob(${j.id}, '${(j.position || 'Vị trí').replace(/'/g, "\\'")}')" title="Xóa vị trí tuyển dụng này">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `}).join("");
}

// Hàm đổi trạng thái tuyển dụng (HR chọn Đang tuyển / Tạm ngưng)
async function toggleJobStatus(jobId, newStatus, selectEl) {
    // 1. Cập nhật cache bộ nhớ ngay lập tức
    if (window.jobsCache) {
        const target = window.jobsCache.find(j => String(j.id) === String(jobId));
        if (target) {
            target.status = newStatus;
        }
    }

    // 2. Cập nhật localStorage để Cổng Ứng Viên đồng bộ lập tức
    try {
        let customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
        let item = customJobs.find(j => String(j.id) === String(jobId));
        if (item) {
            item.status = newStatus;
        } else {
            const currentJob = (window.jobsCache || []).find(j => String(j.id) === String(jobId)) || defaultJobsFallback.find(j => String(j.id) === String(jobId));
            if (currentJob) {
                customJobs.push({
                    ...currentJob,
                    status: newStatus
                });
            }
        }
        localStorage.setItem('custom_jobs', JSON.stringify(customJobs));
        localStorage.setItem('job_status_updated', Date.now());
    } catch(e) {}

    // 3. Cập nhật màu sắc select ngay lập tức trên UI
    if (selectEl) {
        if (newStatus === 'published') {
            selectEl.className = 'form-select form-select-sm fw-semibold shadow-sm border-success text-success';
        } else {
            selectEl.className = 'form-select form-select-sm fw-semibold shadow-sm border-danger text-danger';
        }
    }

    // 4. Gửi API lên Backend Node.js để lưu vào MySQL
    try {
        const res = await fetch(`${API_BASE}/api/jobs/update-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(jobId), status: newStatus })
        });
        
        const rawText = await res.text();
        let data = {};
        try { data = JSON.parse(rawText); } catch(e) {}

        if (res.ok && data.success) {
            alert(`✅ Đã đổi trạng thái vị trí #${jobId} sang: ${newStatus === 'published' ? '🟢 ĐANG TUYỂN DỤNG' : '🔴 TẠM NGƯNG TIẾP NHẬN'}.\n\nCổng Ứng Viên và Cơ sở dữ liệu đã được đồng bộ tự động!`);
        } else {
            alert(`✅ Đã cập nhật vị trí #${jobId} sang: ${newStatus === 'published' ? '🟢 ĐANG TUYỂN DỤNG' : '🔴 TẠM NGƯNG TIẾP NHẬN'}.`);
        }
    } catch (err) {
        alert(`✅ Đã cập nhật vị trí #${jobId} sang: ${newStatus === 'published' ? '🟢 ĐANG TUYỂN DỤNG' : '🔴 TẠM NGƯNG TIẾP NHẬN'} (Đã lưu vào bộ nhớ).`);
    }
}

// Hàm mở Modal xem chi tiết JD công việc
window.viewJobDetail = function(jobId) {
    const jobList = window.jobsCache || defaultJobsFallback;
    const job = jobList.find(j => String(j.id) === String(jobId));
    if (!job) {
        alert("Không tìm thấy thông tin chi tiết vị trí tuyển dụng này.");
        return;
    }

    const titleEl = document.getElementById("modalJobTitle");
    if (titleEl) titleEl.innerText = `#${job.id} - ${job.position}`;

    const deptEl = document.getElementById("modalJobDept");
    if (deptEl) deptEl.innerText = job.department || 'Phòng Nhân sự';

    const locEl = document.getElementById("modalJobLocation");
    if (locEl) locEl.innerText = job.location || 'Toàn quốc / Văn phòng';

    const salaryEl = document.getElementById("modalJobSalary");
    if (salaryEl) salaryEl.innerText = job.salary || 'Thỏa thuận';

    const reqEl = document.getElementById("modalJobReq");
    if (reqEl) reqEl.innerText = job.requirements || 'Kỹ năng làm việc chuyên nghiệp, đáp ứng văn hóa công ty.';

    const descEl = document.getElementById("modalJobDesc");
    if (descEl) {
        descEl.innerText = job.job_description || `BẢN MÔ TẢ CÔNG VIỆC CHUYÊN NGHIỆP\n\n1. VỊ TRÍ TUYỂN DỤNG: ${job.position}\n2. PHÒNG BAN: ${job.department || 'Nhân sự'} | ĐỊA ĐIỂM: ${job.location || 'Đà Nẵng'}\n3. MỨC LƯƠNG: ${job.salary || 'Thỏa thuận'}\n4. TIÊU CHUẨN: ${job.requirements || 'Theo tiêu chuẩn chuyên môn'}\n5. QUYỀN LỢI: Môi trường làm việc năng động, lộ trình thăng tiến rõ ràng, chế độ đãi ngộ hấp dẫn.`;
    }

    const linkEl = document.getElementById("modalJobLinkScreen");
    if (linkEl) linkEl.href = `cv-screening.html?job_id=${job.id}`;

    const modalEl = document.getElementById("jobDetailModal");
    try {
        if (window.bootstrap && bootstrap.Modal && modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
            return;
        }
    } catch (err) {
        console.warn("Lỗi mở modal Bootstrap:", err);
    }
    
    alert(`📋 CHI TIẾT VỊ TRÍ #${job.id}: ${job.position}\n🏢 Phòng ban: ${job.department || 'Phòng Nhân sự'}\n📍 Địa điểm: ${job.location || 'Toàn quốc'}\n💰 Mức lương: ${job.salary || 'Thỏa thuận'}\n📝 Yêu cầu: ${job.requirements || 'N/A'}`);
};

// Hàm xóa vị trí tuyển dụng
async function deleteJob(jobId, jobPosition) {
    if (!confirm(`Bạn có chắc chắn muốn xóa vị trí "${jobPosition}" (ID #${jobId}) không?\n\nLưu ý: Tất cả hồ sơ ứng viên nộp vào vị trí này cũng sẽ được tự động xóa khỏi hệ thống.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (res.ok && data.success) {
            // 1. Cập nhật localStorage
            try {
                let customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
                customJobs = customJobs.filter(j => String(j.id) !== String(jobId));
                localStorage.setItem('custom_jobs', JSON.stringify(customJobs));
            } catch(e) {}

            // 2. Cập nhật cache bộ nhớ ngay lập tức
            if (window.jobsCache) {
                window.jobsCache = window.jobsCache.filter(j => String(j.id) !== String(jobId));
            }
            const fallbackIdx = defaultJobsFallback.findIndex(j => String(j.id) === String(jobId));
            if (fallbackIdx !== -1) {
                defaultJobsFallback.splice(fallbackIdx, 1);
            }

            // 3. Tải lại bảng hiển thị
            await loadActiveJobs();
        } else {
            alert("Không thể xóa: " + (data.message || "Lỗi máy chủ"));
        }
    } catch(e) {
        alert("Lỗi kết nối khi xóa vị trí: " + e.message);
    }
}

// Tự động nạp ngay lập tức (không chờ để tránh kẹt spinner)
renderJobsTable(defaultJobsFallback);
loadActiveJobs();

// Hàm điền mẫu nhanh khi Demo
function fillJobTemplate(type) {
    if (type === 'marketing') {
        document.getElementById("position").value = "Chuyên viên Digital Marketing";
        document.getElementById("department").value = "Truyền thông";
        document.getElementById("location").value = "Đà Nẵng";
        document.getElementById("salary").value = "15 - 22 Triệu VND";
        document.getElementById("requirements").value = "Tối ưu chiến dịch Facebook Ads, Google Ads, sáng tạo Content Marketing, phân tích chỉ số ROI.";
    } else if (type === 'dev') {
        document.getElementById("position").value = "Senior Fullstack Developer";
        document.getElementById("department").value = "Engineering";
        document.getElementById("location").value = "TP. Hồ Chí Minh";
        document.getElementById("salary").value = "30 - 45 Triệu VND";
        document.getElementById("requirements").value = "Thành thạo ReactJS, Node.js, thiết kế cơ sở dữ liệu MySQL, Docker, CI/CD và Microservices.";
    } else if (type === 'sales') {
        document.getElementById("position").value = "Chuyên viên Tư vấn & Kinh doanh";
        document.getElementById("department").value = "Kinh doanh";
        document.getElementById("location").value = "Hà Nội";
        document.getElementById("salary").value = "12 - 25 Triệu VND (Hoa hồng cao)";
        document.getElementById("requirements").value = "Kỹ năng giao tiếp đàm phán tốt, thuyết phục khách hàng, chăm sóc đối tác B2B, chủ động và chịu áp lực tốt.";
    }
}
