const form = document.getElementById("jobForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const jobData = {
        position: document.getElementById("position").value,
        department: document.getElementById("department").value,
        location: document.getElementById("location").value,
        salary: document.getElementById("salary").value,
        requirements: document.getElementById("requirements").value
    };

    message.textContent = "Đang gửi yêu cầu...";

    try {
        const response = await fetch("http://localhost:3000/api/jobs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(jobData)
        });

        const result = await response.json();

        if (result.success) {
            message.textContent = "Đã gửi yêu cầu tuyển dụng thành công!";
            form.reset();
        } else {
            message.textContent = "Gửi yêu cầu thất bại.";
        }

    } catch (error) {
        console.error(error);
        message.textContent = "Không thể kết nối đến Backend.";
    }
});
