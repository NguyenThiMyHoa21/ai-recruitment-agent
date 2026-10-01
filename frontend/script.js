const form = document.getElementById("jobForm");
const btnSubmit = document.getElementById("btnSubmit");
const resultBox = document.getElementById("resultBox");
const errorBox = document.getElementById("errorBox");

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
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>⏳ Đang tạo tin tuyển dụng qua AI...';
    }

    if (resultBox) resultBox.style.display = "none";
    if (errorBox) errorBox.style.display = "none";

    try {
        const response = await fetch("http://localhost:3000/api/jobs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(jobData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            if (resultBox) resultBox.style.display = "block";
            form.reset();
        } else {
            throw new Error(result.message || "Gửi yêu cầu tuyển dụng thất bại.");
        }

    } catch (error) {
        console.error("Lỗi:", error);
        if (errorBox) {
            errorBox.innerHTML = `<strong>❌ Lỗi:</strong> ${error.message}. Vui lòng kiểm tra Backend Node.js port 3000 và n8n đã được bật.`;
            errorBox.style.display = "block";
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> GỬI YÊU CẦU ĐĂNG TIN';
        }
    }
});
