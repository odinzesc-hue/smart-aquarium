 
 // LOGIC SYSTEM: OBFUSCATION (พรางตัวรหัส)
 // นี่คือรหัสลับที่เกิดจาก "****" + "****"แปลงเป็น Base64

    const HIDDEN_KEY = "MjQyNTI3TXlGaXNo"; 

    let currentUserRole = "guest";

    window.onload = function() {
        const savedRole = localStorage.getItem("aquarium_role");
        if (savedRole === "admin") loginSuccess("admin", false);
        else if (savedRole === "guest") loginSuccess("guest", false);
    };

    function checkAdminObfuscated() {
        const inputVal = document.getElementById("password-input").value;
        
        //  เอาค่าที่พิมพ์ มาผสมกับคำลับ (Salt) เพื่อให้เดายากขึ้น
        const salted = inputVal + "MyFish";

        // แปลงเป็นภาษาต่างดาว 
        // btoa คือฟังก์ชันมาตรฐานที่มีในทุก Browser 100%
        let encoded = "";
        try {
            encoded = btoa(salted);
        } catch(e) {
            encoded = "error";
        }

        // 3. เอามาเทียบกับกุญแจที่เราฝังไว้
        if(encoded === HIDDEN_KEY) {
            localStorage.setItem("aquarium_role", "admin");
            loginSuccess("admin", true);
        } else {
            Swal.fire({
                icon: 'error', title: 'รหัสผิด!', text: 'Access Denied', 
                timer: 1500, showConfirmButton: false, background: 'rgba(20, 20, 30, 0.9)', color: '#fff'
            });
            document.getElementById("password-input").value = "";
        }
    }

    function loginAsGuest() {
        localStorage.setItem("aquarium_role", "guest");
        loginSuccess("guest", true);
    }

    function loginSuccess(role, animate) {
        currentUserRole = role;
        updateUIForRole(role);
        const loginSec = document.getElementById("login-section");
        const dashSec = document.getElementById("dashboard-section");

        if (animate) {
            loginSec.style.opacity = '0';
            setTimeout(() => {
                loginSec.style.display = 'none';
                dashSec.style.display = 'block';
                setTimeout(() => { dashSec.style.opacity = '1'; connectMQTT(); }, 50);
            }, 500);
        } else {
            loginSec.style.display = 'none';
            dashSec.style.display = 'block';
            dashSec.style.opacity = '1';
            connectMQTT();
        }
    }

    function updateUIForRole(role) {
        const lightBox = document.getElementById("light-control-box");
        const feedBtn = document.getElementById("feed-control-btn");
        const roleBadge = document.getElementById("user-role-badge");
        const lightArrow = document.getElementById("light-arrow");

        if (role === 'admin') {
            roleBadge.innerText = "Admin Access";
            roleBadge.style.background = "#00ff88"; roleBadge.style.color = "#000";
            lightBox.classList.remove("disabled-control");
            feedBtn.classList.remove("disabled-control");
            feedBtn.innerHTML = '<i class="fas fa-cookie-bite"></i> ปุ่มให้อาหารน้องปลา';
            lightArrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
        } else {
            roleBadge.innerText = "Guest Mode";
            roleBadge.style.background = "rgba(255,255,255,0.2)"; roleBadge.style.color = "#fff";
            lightBox.classList.add("disabled-control");
            feedBtn.classList.add("disabled-control");
            feedBtn.innerHTML = '<i class="fas fa-lock"></i> เฉพาะแอดมิน';
            lightArrow.innerHTML = '<i class="fas fa-lock"></i>';
        }
    }

    function logout() {
        Swal.fire({
            title: 'ออกจากระบบ?', icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#d33', confirmButtonText: 'Logout', background: 'rgba(20, 20, 30, 0.9)', color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem("aquarium_role");
                location.reload();
            }
        });
    }

    
    //  MQTT CONFIG (SECURE WSS)
   
    const mqtt_config = { host: "broker.emqx.io", port: 8084, path: "/mqtt", clientId: "Aqua_" + Math.random().toString(16).substr(2, 8) };
    const topics = {
        sub_light: "home/desk/lamp/state", sub_temp: "temperature/cmd", sub_water: "tank/water/state",
        sub_turbidity: "home/fish/turbidity/state", sub_feed_count: "fish/feeder/count_today",
        sub_cam: "esp32/cam/image", pub_light: "home/desk/lamp/cmd", pub_feed: "feeder/cmd"
    };

    let client = new Paho.MQTT.Client(mqtt_config.host, mqtt_config.port, mqtt_config.path, mqtt_config.clientId);
    let lightState = false;

    function onConnect() {
        console.log("MQTT Connected");
        document.getElementById("status-text").innerText = "Online"; document.getElementById("status-text").style.color = "#00ff88"; document.getElementById("status-dot").style.backgroundColor = "#00ff88"; 
        Object.keys(topics).forEach(key => { if(key.startsWith('sub_')) client.subscribe(topics[key]); });
    }
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) { console.log("Lost: " + responseObject.errorMessage); document.getElementById("status-text").innerText = "Reconnecting..."; document.getElementById("status-text").style.color = "orange"; document.getElementById("status-dot").style.backgroundColor = "orange"; setTimeout(connectMQTT, 3000); }
    }
    function onMessageArrived(message) {
        const topic = message.destinationName; const payload = message.payloadString;
        switch(topic) {
            case topics.sub_cam: document.getElementById("cam-img").src = payload.startsWith('data:image') ? payload : "data:image/jpeg;base64," + payload; break;
            case topics.sub_temp:
                try {
                    const parsed = JSON.parse(payload);
                    const tempC = typeof parsed === 'object' && parsed.c !== undefined ? parseFloat(parsed.c) : parseFloat(payload);
                    updateTemperatureGauge(tempC);
                } catch (e) {
                    const tempC = parseFloat(payload);
                    updateTemperatureGauge(tempC);
                }
                break;
            case topics.sub_water: 
                const wEl = document.getElementById("water-val"); const wIcon = document.getElementById("water-icon"); wEl.innerText = payload;
                if(payload.includes("แห้ง") || payload.toLowerCase().includes("low")) { wEl.style.color = "#ff4757"; wIcon.className = "fas fa-exclamation-triangle"; wIcon.style.color = "#ff4757"; wIcon.style.opacity = "1"; } 
                else { wEl.style.color = "#fff"; wIcon.className = "fas fa-check-circle"; wIcon.style.color = "#00ff88"; wIcon.style.opacity = "1"; }
                break;
            case topics.sub_turbidity: document.getElementById("turbidity-val").innerText = payload; break;
            case topics.sub_feed_count: document.getElementById("feed-count-val").innerText = payload; break;
            case topics.sub_light: updateLightUI(payload); break;
        }
    }

    function toggleLight() {
        if (currentUserRole !== 'admin') return;
        const newState = !lightState; const msgStr = newState ? "on" : "off";
        message = new Paho.MQTT.Message(msgStr); message.destinationName = topics.pub_light; message.retained = true; client.send(message); updateLightUI(msgStr);
    }
    function updateLightUI(payload) {
        const panel = document.getElementById("light-control-box"); const txt = document.getElementById("light-status-text");
        if (payload.toLowerCase() === "on") { lightState = true; panel.classList.add("active"); txt.innerText = "เปิดใช้งาน"; txt.style.color = "#00f2ff"; } 
        else { lightState = false; panel.classList.remove("active"); txt.innerText = "ปิดอยู่"; txt.style.color = "rgba(255,255,255,0.5)"; }
    }
    function feedFish() {
        if (currentUserRole !== 'admin') return;
        message = new Paho.MQTT.Message("FEED"); message.destinationName = topics.pub_feed; client.send(message);
        Swal.fire({ title: 'งั่มๆ! อร่อยจัง 🐟', text: 'ให้อาหารแล้ว', imageUrl: 'https://cdn-icons-png.flaticon.com/512/3065/3065849.png', imageWidth: 80, imageHeight: 80, timer: 2000, showConfirmButton: false, background: 'rgba(20, 20, 30, 0.9)', color: '#fff' });
    }
    function updateTemperatureGauge(tempC) {
        if (isNaN(tempC)) return;
        tempC = Math.max(0, Math.min(50, tempC));
        // map 0..50 -> -90deg..90deg
        const angle = -90 + (tempC / 50) * 180;
        const needle = document.getElementById('temp-needle');
        if (needle) {
            // use SVG rotate around pivot (100,120) only (avoid CSS transform to prevent double-rotation)
            needle.setAttribute('transform', `rotate(${angle} 100 120)`);
        }
        const disp = document.getElementById('temp-val-display');
        if (disp) {
            disp.innerText = `${tempC.toFixed(1)} °C`;
            if (tempC < 10) disp.style.color = '#66a3ff';
            else if (tempC < 20) disp.style.color = '#00e5ff';
            else if (tempC < 28) disp.style.color = '#7cffb2';
            else if (tempC < 35) disp.style.color = '#ffd24d';
            else disp.style.color = '#ff6b6b';
        }
    }

    function connectMQTT() {
        client.onConnectionLost = onConnectionLost; client.onMessageArrived = onMessageArrived;
        client.connect({ useSSL: true, onSuccess: onConnect, onFailure: (err) => { console.log("Connect Fail", err); document.getElementById("status-text").innerText = "Failed"; document.getElementById("status-text").style.color = "red"; }, keepAliveInterval: 30 });
    }