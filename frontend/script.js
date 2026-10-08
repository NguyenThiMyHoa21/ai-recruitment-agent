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
        let response;
        let n8nData = {};

        try {
            // 1. Gửi trực tiếp đến n8n Webhook (Cổng 5678)
            response = await fetch("http://localhost:5678/webhook/job-posting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jobData)
            });
            if (response.ok) {
                n8nData = await response.json();
            }
        } catch (errDirect) {
            // 2. Dự phòng gửi qua backend Node.js (Cổng 3000)
            response = await fetch("http://localhost:3000/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jobData)
            });
            const result = await response.json();
            try {
                n8nData = typeof result.n8nResponse === "string" ? JSON.parse(result.n8nResponse) : (result.n8nResponse || {});
            } catch (e) {
                n8nData = {};
            }
        }

        if (response && response.ok) {

            const jd = n8nData.job_description || 
                `BẢN MÔ TẢ CÔNG VIỆC CHUYÊN NGHIỆP\n\n1. VỊ TRÍ TUYỂN DỤNG: ${jobData.position}\n2. PHÒNG BAN: ${jobData.department} | ĐỊA ĐIỂM: ${jobData.location}\n3. MỨC LƯƠNG: ${jobData.salary}\n4. TIÊU CHUẨN ỨNG VIÊN: ${jobData.requirements}\n5. QUYỀN LỢI ĐÃI NGỘ: Môi trường làm việc năng động, lộ trình phát triển rõ ràng, bảo hiểm đầy đủ, thưởng theo hiệu suất.`;

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

            // Tự động chèn ngay vị trí mới tạo lên đầu bảng danh sách
            const newJobId = (defaultJobsFallback[0]?.id || 16) + 1;
            const newJobItem = {
                id: newJobId,
                position: jobData.position,
                department: jobData.department,
                salary: jobData.salary
            };
            defaultJobsFallback.unshift(newJobItem);
            try {
                const customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
                customJobs.unshift(newJobItem);
                localStorage.setItem('custom_jobs', JSON.stringify(customJobs));
            } catch(e) {}
            renderJobsTable(defaultJobsFallback);

            // Đồng bộ lại với backend MySQL nếu có
            loadActiveJobs();
        } else {
            throw new Error("Gửi yêu cầu tuyển dụng thất bại. Vui lòng kiểm tra n8n đã được kích hoạt.");
        }

    } catch (error) {
        console.error("Lỗi:", error);
        if (errorBox) {
            errorBox.innerHTML = `<strong>❌ Lỗi kết nối:</strong> ${error.message}. Vui lòng kiểm tra Backend (port 3000) và n8n đã được kích hoạt.`;
            errorBox.style.display = "block";
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> GỬI YÊU CẦU ĐĂNG TIN';
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
    { id: 18, position: "Chuyên viên Digital Marketing", department: "Truyền thông", salary: "18 - 25 Triệu VND", requirements: "Tối ưu chiến dịch Facebook Ads, Google Ads, sáng tạo Content Marketing, phân tích chỉ số ROI" },
    { id: 17, position: "Product Manager", department: "Product", salary: "30 - 45 Triệu VND", requirements: "Agile, Scrum, Product Roadmapping, Data Analysis" },
    { id: 16, position: "Chuyên viên Marketing", department: "Truyền thông", salary: "15 - 20 Triệu VND", requirements: "Marketing, Digital Marketing, Facebook Ads, Google Ads, SEO" },
    { id: 15, position: "Chuyên viên Marketing", department: "Truyền thông", salary: "15 - 20 Triệu VND", requirements: "Content, Facebook Ads, SEO" },
    { id: 14, position: "Senior Backend Engineer Test 2", department: "Engineering", salary: "35 - 50 Triệu VND", requirements: "Node.js, Golang, Docker, Microservices" },
    { id: 13, position: "Nhân viên chăm sóc khách hàng", department: "CSKH", salary: "8 - 12 Triệu VND", requirements: "Kỹ năng giao tiếp, chăm sóc khách hàng, nhiệt tình" },
    { id: 12, position: "Kỹ sư Công nghệ thông tin", department: "IT Software", salary: "15 - 25 Triệu VND", requirements: "Phần mềm, lập trình, giải quyết vấn đề kỹ thuật" },
    { id: 11, position: "Nhân viên kinh doanh", department: "Kinh doanh", salary: "10 - 20 Triệu VND", requirements: "Kỹ năng bán hàng, giao tiếp, tìm kiếm khách hàng" },
    { id: 8,  position: "Frontend Developer", department: "Engineering", salary: "18 - 28 Triệu VND", requirements: "Thạo ReactJS, HTML, CSS" }
];

async function loadActiveJobs() {
    const tbody = document.getElementById("jobsTableBody");
    if (!tbody) return;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("http://localhost:3000/api/jobs", { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (res.ok && data.success && data.jobs && data.jobs.length > 0) {
            renderJobsTable(data.jobs);
            return;
        }
        throw new Error("Không có dữ liệu");
    } catch (e) {
        let combined = [...defaultJobsFallback];
        try {
            const customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
            customJobs.forEach(cj => {
                if (!combined.some(j => String(j.id) === String(cj.id))) {
                    combined.unshift(cj);
                }
            });
        } catch(err) {}
        renderJobsTable(combined);
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
    try {
        const res = await fetch("http://localhost:3000/api/jobs/update-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(jobId), status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (selectEl) {
                if (newStatus === 'published') {
                    selectEl.className = 'form-select form-select-sm fw-semibold shadow-sm border-success text-success';
                } else {
                    selectEl.className = 'form-select form-select-sm fw-semibold shadow-sm border-danger text-danger';
                }
            }
            alert(`✅ Đã cập nhật vị trí #${jobId} sang trạng thái: ${newStatus === 'published' ? '🟢 ĐANG TUYỂN DỤNG' : '🔴 TẠM NGƯNG TIẾP NHẬN'}.\n\nCổng Ứng Viên đã được đồng bộ tự động!`);
        } else {
            alert("Lỗi khi cập nhật trạng thái: " + (data.message || 'Không thể đổi trạng thái'));
        }
    } catch (err) {
        alert("Lỗi kết nối máy chủ: " + err.message);
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
    if (!confirm(`Bạn có chắc chắn muốn xóa vị trí "${jobPosition}" (ID #${jobId}) không?\n\nLưu ý: Tất cả hồ sơ ứng viên nộp vào vị trí này cũng sẽ được tự động xóa khỏi MySQL.`)) {
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/jobs/${jobId}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (res.ok && data.success) {
            // Xóa khỏi localStorage nếu có
            try {
                let customJobs = JSON.parse(localStorage.getItem('custom_jobs') || '[]');
                customJobs = customJobs.filter(j => String(j.id) !== String(jobId));
                localStorage.setItem('custom_jobs', JSON.stringify(customJobs));
            } catch(e) {}

            // Tải lại danh sách việc làm
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
