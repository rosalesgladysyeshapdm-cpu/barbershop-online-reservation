// Set this to the deployed Render API URL after deploying. Local development uses localhost.
const API_URL = "http://localhost:5000";
const TERMS_VERSION = "v1.0";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { token: localStorage.getItem("kpb_token") || "", user: null, services: [], barbers: [], reservations: [], currentView: "Dashboard", toastTimer: null };

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function money(value) { return new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP" }).format(Number(value || 0)); }
function dateTime(value) {
  if (!value) return "Not scheduled";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Invalid date" : d.toLocaleString("en-PH", { dateStyle:"medium", timeStyle:"short" });
}
function dateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function statusClass(value = "") { return value.toLowerCase().replaceAll(" ", "-"); }
function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.background = error ? "#ffb4b4" : "var(--pink)";
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) {
      localStorage.removeItem("kpb_token"); state.token = ""; state.user = null;
    }
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}
function currentPageRole() {
  const file = location.pathname.split("/").pop().toLowerCase();
  if (file === "customer.html") return "customer";
  if (file === "barber.html") return "barber";
  if (file === "admin.html") return "admin";
  return "public";
}
function pageForRole(role) {
  return ({ customer: "customer.html", barber: "barber.html", admin: "admin.html" })[role] || "index.html";
}
function showPublic() {
  if (currentPageRole() !== "public") { location.href = "index.html"; return; }
  $("#authSection")?.classList.add("hidden");
  $("#dashboardSection")?.classList.add("hidden");
  $$(".site-header, main > .section, .site-footer").forEach(el => {
    if (el.id !== "authSection" && el.id !== "dashboardSection") el.classList.remove("hidden");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showAuth(mode = "login") {
  $$(".site-header, main > .section, .site-footer").forEach(el => {
    if (el.id !== "authSection" && el.id !== "dashboardSection") el.classList.add("hidden");
  });
  $("#authSection").classList.remove("hidden");
  $("#dashboardSection")?.classList.add("hidden");
  $("#loginPanel").classList.toggle("hidden", mode !== "login");
  $("#registerPanel").classList.toggle("hidden", mode !== "register");
  $("#loginMessage").textContent = ""; $("#registerMessage").textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showDashboard() {
  const pageRole = currentPageRole();
  if (pageRole === "public" || pageRole !== state.user.role) {
    location.href = pageForRole(state.user.role);
    return;
  }
  $("#authSection")?.classList.add("hidden");
  $("#dashboardSection")?.classList.remove("hidden");
  $("#sidebarName").textContent = state.user.name;
  $("#topbarName").textContent = state.user.name;
  $("#userAvatar").textContent = state.user.name.slice(0,1).toUpperCase();
  $("#sidebarRole").textContent = state.user.role;
  buildNav();
  renderView("Dashboard");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function buildNav() {
  const common = [["Dashboard","▦"],["My Reservations","▣"],["New Reservation","＋"],["My Profile","◎"],["Notifications","♧"]];
  const admin = [["Dashboard","▦"],["Reservations","▣"],["Customers","♙"],["Staff","♟"],["Services","✂"],["Revenue","＄"],["My Profile","◎"],["Notifications","♧"]];
  const barber = [["Dashboard","▦"],["My Schedule","▦"],["My Reservations","▣"],["My Profile","◎"],["Notifications","♧"]];
  const nav = state.user.role === "admin" ? admin : state.user.role === "barber" ? barber : common;
  $("#dashboardNav").innerHTML = nav.map(([label, icon]) => `<button data-dash-view="${escapeHtml(label)}" class="${state.currentView === label ? "active" : ""}">${icon} &nbsp; ${escapeHtml(label)}</button>`).join("");
}
async function loadInitialData() {
  const [s, b] = await Promise.all([api("/api/services"), api("/api/barbers")]);
  state.services = s.services || []; state.barbers = b.barbers || [];
}
function renderPublicServices() {
  const host = $("#publicServices");
  if (!state.services.length) {
    host.innerHTML = `<div class="panel"><p>No active services yet. An admin can add services after logging in.</p></div>`;
    return;
  }
  host.innerHTML = state.services.slice(0, 6).map(s => `
    <article class="service-card">
      <div class="service-icon">✂</div><h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.description || "Professional barbershop service.")}</p>
      <div class="service-bottom"><span class="price">${money(s.price)}</span><button data-book-service="${s._id}">Book →</button></div>
      <small class="muted">${Number(s.durationMinutes)} minutes</small>
    </article>`).join("");
}
function statCard(label, value) { return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function panel(title, content, extra = "") { return `<section class="panel"><div class="panel-header"><h3>${title}</h3>${extra}</div>${content}</section>`; }
function statusBadge(status) { return `<span class="status ${statusClass(status)}">${escapeHtml(status || "—")}</span>`; }
function reservationTable(rows, admin = false) {
  if (!rows.length) return `<div class="empty-state">No reservations to show yet.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Reservation ID</th>${admin?'<th>Customer</th>':''}<th>Service</th><th>Barber</th><th>Date & Time</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr>
    <td>${escapeHtml(r.reservationCode)}</td>${admin?`<td>${escapeHtml(r.customer?.name || "—")}</td>`:""}
    <td>${escapeHtml(r.serviceName || r.service?.name || "—")}</td><td>${escapeHtml(r.barber?.name || "Not assigned")}</td>
    <td>${dateTime(r.appointmentDate)}</td><td>${money(r.servicePrice)}</td><td>${statusBadge(r.paymentStatus)}</td><td>${statusBadge(r.status)}</td>
    <td><button class="table-action" data-view-reservation="${r._id}">View</button>${(state.user.role==="customer" && !["Completed","Rejected","Cancelled"].includes(r.status))?`<button class="table-action" data-cancel-reservation="${r._id}">Cancel</button>`:""}</td>
  </tr>`).join("")}</tbody></table></div>`;
}
async function loadReservations() {
  const data = await api("/api/reservations");
  state.reservations = data.reservations || [];
  return state.reservations;
}
async function renderView(view) {
  state.currentView = view;
  buildNav();
  $("#pageTitle").textContent = view;
  $("#dashEyebrow").textContent = state.user.role.toUpperCase() + " AREA";
  const host = $("#dashboardContent");
  host.innerHTML = `<div class="panel">Loading your information…</div>`;
  try {
    if (["Dashboard","My Reservations","Reservations","My Schedule"].includes(view)) await loadReservations();
    if (["Dashboard","Services","New Reservation"].includes(view)) {
      const d = await api("/api/services"); state.services = d.services || [];
    }
    if (view === "Dashboard") {
      if (state.user.role === "admin") return renderAdminDashboard();
      if (state.user.role === "barber") return renderBarberDashboard();
      return renderCustomerDashboard();
    }
    if (view === "New Reservation") return renderNewReservation();
    if (view === "My Reservations" || view === "Reservations" || view === "My Schedule") return renderReservationsView(view);
    if (view === "My Profile") return renderProfile();
    if (view === "Notifications") return renderNotifications();
    if (view === "Services") return renderServicesAdmin();
    if (view === "Customers") return renderCustomersAdmin();
    if (view === "Staff") return renderStaffAdmin();
    if (view === "Revenue") return renderRevenueAdmin();
    host.innerHTML = `<div class="panel"><h3>${escapeHtml(view)}</h3><p class="muted">This section is not available for this account role.</p></div>`;
  } catch (err) {
    host.innerHTML = `<div class="panel"><h3>Unable to load this page</h3><p class="muted">${escapeHtml(err.message)}</p><button class="btn btn-secondary" data-dash-view="Dashboard">Back to Dashboard</button></div>`;
  }
}
function renderCustomerDashboard() {
  const rows = state.reservations;
  const now = Date.now();
  const upcoming = rows.filter(r => new Date(r.appointmentDate).getTime() >= now && !["Cancelled","Rejected","Completed"].includes(r.status));
  $("#dashboardContent").innerHTML = `
    <div class="welcome-panel"><p class="eyebrow">WELCOME BACK</p><h3>Hello, ${escapeHtml(state.user.name.split(" ")[0])}.</h3><p>Ready for your next fresh cut? Your reservations are all in one place.</p><div class="form-actions"><button class="btn btn-pink" data-dash-view="New Reservation">＋ New Reservation</button></div></div>
    <div class="stats-grid">${statCard("Total Reservations",rows.length)}${statCard("Upcoming",upcoming.length)}${statCard("Completed",rows.filter(r=>r.status==="Completed").length)}${statCard("Cancelled",rows.filter(r=>r.status==="Cancelled").length)}</div>
    ${panel("Recent Reservations",reservationTable(rows.slice(0,5)))}`;
}
function renderBarberDashboard() {
  const rows = state.reservations;
  $("#dashboardContent").innerHTML = `<div class="welcome-panel"><p class="eyebrow">BARBER WORKSPACE</p><h3>Welcome, ${escapeHtml(state.user.name)}.</h3><p>Check your assigned appointments and keep your schedule updated.</p></div>
  <div class="stats-grid">${statCard("Appointments",rows.length)}${statCard("Pending",rows.filter(r=>r.status.includes("Pending")).length)}${statCard("Confirmed",rows.filter(r=>r.status==="Confirmed").length)}${statCard("Completed",rows.filter(r=>r.status==="Completed").length)}</div>
  ${panel("Assigned Appointments",reservationTable(rows))}`;
}
function renderAdminDashboard() {
  const rows = state.reservations;
  $("#dashboardContent").innerHTML = `<div class="welcome-panel"><p class="eyebrow">ADMINISTRATION</p><h3>System overview.</h3><p>Manage reservations, services, staff, and customer records.</p></div>
  <div class="stats-grid">${statCard("Reservations",rows.length)}${statCard("Pending Verification",rows.filter(r=>r.paymentStatus==="Pending Verification").length)}${statCard("Confirmed",rows.filter(r=>r.status==="Confirmed").length)}${statCard("Completed",rows.filter(r=>r.status==="Completed").length)}</div>
  ${panel("Recent Reservations",reservationTable(rows.slice(0,10),true))}
  ${panel("Quick actions",`<div class="form-actions"><button class="btn btn-pink" data-dash-view="Services">Manage Services</button><button class="btn btn-secondary" data-dash-view="Staff">Manage Staff</button><button class="btn btn-secondary" data-dash-view="Customers">Manage Customers</button><button class="btn btn-secondary" data-dash-view="Revenue">View Revenue</button></div>`)}`;
}
function renderNewReservation() {
  if (!state.services.length) {
    $("#dashboardContent").innerHTML = `<div class="panel"><h3>No services are available</h3><p class="muted">Please ask the shop administrator to add an active service before booking.</p></div>`;
    return;
  }
  const minDate = new Date(Date.now()+3600000).toISOString().slice(0,10);
  $("#dashboardContent").innerHTML = `
    <div class="notice">Please review the service, date, and payment method carefully. Your booking stays pending until the shop verifies your payment and approves the reservation.</div>
    <form id="reservationForm">
      ${panel("A. Appointment Details",`<div class="field-grid">
        <div class="field"><label for="bookingService">Service *</label><select id="bookingService" required><option value="">Choose a service</option>${state.services.map(s=>`<option value="${s._id}">${escapeHtml(s.name)} — ${money(s.price)} (${s.durationMinutes} min)</option>`).join("")}</select></div>
        <div class="field"><label for="bookingBarber">Preferred Barber</label><select id="bookingBarber"><option value="any">Any Available Barber</option>${state.barbers.map(b=>`<option value="${b._id}">${escapeHtml(b.name)}</option>`).join("")}</select></div>
        <div class="field"><label for="bookingDate">Appointment Date *</label><input id="bookingDate" type="date" min="${minDate}" required></div>
        <div class="field"><label for="bookingTime">Appointment Time *</label><select id="bookingTime" required><option value="">Choose date first</option></select></div>
        <div class="field full-row"><label for="bookingNotes">Customer Notes (optional)</label><textarea id="bookingNotes" maxlength="1000" placeholder="Haircut preference or special request"></textarea></div>
      </div>`)}
      ${panel("B. Mode of Payment",`<div class="payment-methods">
        <label class="payment-option"><input type="radio" name="paymentMethod" value="GCash" required> GCash</label>
        <label class="payment-option"><input type="radio" name="paymentMethod" value="Maya" required> Maya</label>
      </div><div id="qrPanel" class="qr-panel"><div class="qr-placeholder">Choose GCash or Maya to display the shop QR code.</div><div><b>Payment instructions</b><p class="muted">Pay the displayed amount using the selected shop QR code, then upload your receipt below. A receipt still needs admin verification.</p></div></div>`)}
      ${panel("C. Upload Proof of Payment",`<div class="field"><label for="paymentProof">Payment receipt image (JPG/JPEG/PNG, max 3 MB) *</label><input id="paymentProof" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" required><small class="muted" id="fileName">No file selected.</small><div id="receiptPreview"></div></div>`)}
      ${panel("D. Reservation Summary",`<div class="summary-list" id="bookingSummary"><div class="summary-row"><span>Service</span><span>Choose a service</span></div><div class="summary-row"><span>Service price</span><span>₱0.00</span></div></div>`)}
      ${panel("E. Terms and Conditions",`<div class="terms-box"><b>Terms and Conditions — Version ${TERMS_VERSION}</b><ol>
        <li>Please arrive on time for your appointment.</li><li>The uploaded payment receipt must be genuine and will be checked by the barbershop.</li><li>Submitting a receipt does not automatically confirm a reservation. The booking is confirmed only after payment verification and shop approval.</li><li>Availability may change until the booking is approved. The shop will notify you if there is a conflict.</li><li>Cancellation and rescheduling are subject to shop policy.</li><li>Refunds are handled under the shop's stated policy and applicable consumer laws, including cases such as duplicate payment or shop cancellation where applicable.</li><li>Please provide accurate account and payment details and treat staff respectfully.</li><li>Your details and reservation history will be used to manage bookings and communicate reservation updates.</li>
      </ol></div><label class="check-row"><input id="termsAccepted" type="checkbox" required><span>I have read and agree to the Terms and Conditions. *</span></label>`)}
      <div class="form-actions"><button class="btn btn-pink" id="submitReservation" type="submit" disabled>Submit Reservation <span>→</span></button><button class="btn btn-secondary" type="button" data-dash-view="Dashboard">Cancel</button></div>
      <p id="reservationMessage" class="form-message" aria-live="polite"></p>
    </form>`;
  const form = $("#reservationForm");
  const serviceEl = $("#bookingService"), dateEl = $("#bookingDate"), timeEl = $("#bookingTime"), proofEl = $("#paymentProof"), termsEl = $("#termsAccepted");
  function updateSummary() {
    const service = state.services.find(s=>s._id===serviceEl.value);
    const barber = state.barbers.find(b=>b._id===$("#bookingBarber").value);
    const method = $('input[name="paymentMethod"]:checked')?.value || "Not selected";
    const rows = [
      ["Service", service?.name || "Choose a service"],
      ["Barber", barber?.name || ($("#bookingBarber").value==="any" ? "Any Available Barber" : "Choose a barber")],
      ["Date & Time", dateEl.value && timeEl.value ? `${dateEl.value} ${timeEl.value}` : "Choose schedule"],
      ["Duration", service ? `${service.durationMinutes} minutes` : "—"],
      ["Payment Method", method],
      ["Service Price / Total", money(service?.price || 0)]
    ];
    $("#bookingSummary").innerHTML = rows.map((r,i)=>`<div class="summary-row"><span>${r[0]}</span><span>${escapeHtml(r[1])}</span></div>`).join("");
  }
  function validateReady() {
    const method = $('input[name="paymentMethod"]:checked');
    $("#submitReservation").disabled = !(serviceEl.value && dateEl.value && timeEl.value && method && proofEl.files.length && termsEl.checked);
  }
  function updateQr() {
    const method = $('input[name="paymentMethod"]:checked')?.value;
    const filename = method==="GCash" ? "gcash-qr.png" : "maya-qr.png";
    const label = method || "Payment method";
    const src = `assets/${filename}`;
    $("#qrPanel").innerHTML = method ? `<img class="qr-image" src="${src}" alt="${label} shop QR code" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="qr-placeholder" style="display:none">Add ${filename}<br>to frontend/assets/</div><div><b>${label} QR Payment</b><p class="muted">Scan the shop's official QR code. Make sure the recipient name and amount are correct before paying.</p><small class="muted">Image path: frontend/${src}</small></div>` : `<div class="qr-placeholder">Choose GCash or Maya to display the shop QR code.</div><div><b>Payment instructions</b><p class="muted">Select a payment method to see the matching QR code.</p></div>`;
  }
  function updateTimes() {
    const chosenDate = dateEl.value;
    const old = timeEl.value;
    const slots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30"];
    timeEl.innerHTML = `<option value="">Choose time</option>` + (chosenDate ? slots.filter(t=>new Date(`${chosenDate}T${t}:00`).getTime()>Date.now()).map(t=>`<option value="${t}">${t}</option>`).join("") : "");
    if (slots.includes(old)) timeEl.value = old;
    updateSummary(); validateReady();
  }
  serviceEl.addEventListener("change",()=>{updateSummary();validateReady();});
  $("#bookingBarber").addEventListener("change",updateSummary);
  dateEl.addEventListener("change",updateTimes); timeEl.addEventListener("change",()=>{updateSummary();validateReady();});
  $$('input[name="paymentMethod"]').forEach(el=>el.addEventListener("change",()=>{updateQr();updateSummary();validateReady();}));
  termsEl.addEventListener("change",validateReady);
  proofEl.addEventListener("change",()=>{
    const file = proofEl.files[0];
    $("#receiptPreview").innerHTML = ""; $("#fileName").textContent = file ? `${file.name} (${(file.size/1024).toFixed(0)} KB)` : "No file selected.";
    if(file){
      if(!["image/jpeg","image/png"].includes(file.type) || file.size>3*1024*1024){
        proofEl.value=""; $("#fileName").textContent="Invalid file. Choose JPG/JPEG or PNG up to 3 MB."; showToast("Invalid receipt image. Maximum size is 3 MB.",true);
      } else {
        const img=document.createElement("img"); img.alt="Receipt preview"; img.style.cssText="max-width:220px;max-height:220px;object-fit:contain;margin-top:12px;border-radius:8px;background:white;padding:4px";
        img.src=URL.createObjectURL(file); $("#receiptPreview").appendChild(img);
      }
    }
    validateReady();
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault(); validateReady(); if($("#submitReservation").disabled)return;
    const msg=$("#reservationMessage");msg.textContent="Submitting reservation…";msg.classList.remove("error");
    try{
      const fd=new FormData();
      fd.append("serviceId",serviceEl.value);fd.append("barberId",$("#bookingBarber").value);
      fd.append("date",dateEl.value);fd.append("time",timeEl.value);fd.append("customerNotes",$("#bookingNotes").value);
      fd.append("paymentMethod",$('input[name="paymentMethod"]:checked').value);fd.append("termsAccepted","true");fd.append("paymentProof",proofEl.files[0]);
      const result=await api("/api/reservations",{method:"POST",body:fd});
      msg.textContent=`${result.message} Reservation ID: ${result.reservation.reservationCode}`;
      showToast("Reservation submitted successfully.");
      await renderView("My Reservations");
    }catch(err){msg.textContent=err.message;msg.classList.add("error");}
  });
  updateSummary();
}
function renderReservationsView(view) {
  const admin=state.user.role==="admin";
  let rows=state.reservations;
  const isBarberSchedule=view==="My Schedule";
  $("#dashboardContent").innerHTML=`${panel(view,`<div class="toolbar"><input id="reservationSearch" placeholder="Search reservation ID or service"><select id="reservationFilter"><option value="">All statuses</option>${["Pending Verification","Pending Approval","Confirmed","Rejected","In Progress","Completed","Cancelled"].map(s=>`<option>${s}</option>`).join("")}</select></div><div id="reservationTable">${reservationTable(rows,admin)}</div>`)}
    ${admin?panel("Review and manage reservations",`<p class="muted">Open a reservation to verify its payment, approve or reject it, or assign a barber. Payment verification and reservation approval are separate steps.</p>`):""}`;
  function filter() {
    const q=$("#reservationSearch").value.toLowerCase(), s=$("#reservationFilter").value;
    const filtered=rows.filter(r=>(!s||r.status===s)&&(`${r.reservationCode} ${r.serviceName} ${r.customer?.name||""}`).toLowerCase().includes(q));
    $("#reservationTable").innerHTML=reservationTable(filtered,admin);
  }
  $("#reservationSearch").addEventListener("input",filter);$("#reservationFilter").addEventListener("change",filter);
}
async function renderProfile() {
  const data=await api("/api/profile"); state.user=data.user;
  $("#dashboardContent").innerHTML=panel("My Profile",`<form id="profileForm" class="field-grid">
    <div class="field full-row"><label for="profileName">Full Name</label><input id="profileName" value="${escapeHtml(state.user.name)}" required></div>
    <div class="field"><label for="profileEmail">Email Address</label><input id="profileEmail" type="email" value="${escapeHtml(state.user.email)}" required></div>
    <div class="field"><label for="profilePhone">Contact Number</label><input id="profilePhone" value="${escapeHtml(state.user.phone||"")}"></div>
    <div class="field full-row"><label>Username</label><input value="${escapeHtml(state.user.username)}" disabled><small class="muted">Username cannot be changed here.</small></div>
    <div class="field full-row"><button class="btn btn-pink" type="submit">Save Changes</button></div><p id="profileMessage" class="form-message full-row"></p></form>`);
  $("#profileForm").addEventListener("submit",async e=>{
    e.preventDefault();try{const result=await api("/api/profile",{method:"PATCH",body:{name:$("#profileName").value,email:$("#profileEmail").value,phone:$("#profilePhone").value}});state.user=result.user;$("#sidebarName").textContent=state.user.name;$("#topbarName").textContent=state.user.name;showToast(result.message);}catch(err){$("#profileMessage").textContent=err.message;$("#profileMessage").classList.add("error");}
  });
}
async function renderNotifications() {
  const data=await api("/api/notifications");
  $("#dashboardContent").innerHTML=panel("Notifications",data.notifications.length?data.notifications.map(n=>`<div class="summary-row"><div><b>${escapeHtml(n.message)}</b><div class="muted">${dateTime(n.createdAt)} · ${n.read?"Read":"Unread"}</div></div>${n.read?"":`<button class="table-action" data-read-notification="${n._id}">Mark read</button>`}</div>`).join(""):`<div class="empty-state">No notifications yet.</div>`);
}
async function renderServicesAdmin() {
  const data=await api("/api/services");const all=data.services;
  $("#dashboardContent").innerHTML=`${panel("Add Service",`<form id="serviceForm" class="field-grid">
    <div class="field"><label>Service Name *</label><input id="serviceName" required></div><div class="field"><label>Price (PHP) *</label><input id="servicePrice" type="number" min="0" step=".01" required></div>
    <div class="field"><label>Duration in minutes *</label><input id="serviceDuration" type="number" min="5" step="5" required></div><div class="field"><label>Image path (optional)</label><input id="serviceImage" placeholder="assets/services/cut.jpg"></div>
    <div class="field full-row"><label>Description</label><textarea id="serviceDescription"></textarea></div><div class="field full-row"><button class="btn btn-pink">Add Service</button></div><p id="serviceMessage" class="form-message full-row"></p></form>`)}
    ${panel("Existing Services",`<div class="table-wrap"><table><thead><tr><th>Service</th><th>Price</th><th>Duration</th><th>Status</th><th>Action</th></tr></thead><tbody>${all.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${money(s.price)}</td><td>${s.durationMinutes} min</td><td>${statusBadge(s.active?"Active":"Inactive")}</td><td>${s.active?`<button class="table-action" data-deactivate-service="${s._id}">Deactivate</button>`:"—"}</td></tr>`).join("")}</tbody></table></div>`)}`;
  $("#serviceForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/services",{method:"POST",body:{name:$("#serviceName").value,price:Number($("#servicePrice").value),durationMinutes:Number($("#serviceDuration").value),image:$("#serviceImage").value,description:$("#serviceDescription").value,active:true}});showToast("Service added.");renderView("Services");}catch(err){$("#serviceMessage").textContent=err.message;$("#serviceMessage").classList.add("error");}});
}
async function renderCustomersAdmin() {
  const data=await api("/api/admin/users");const users=data.users.filter(u=>u.role==="customer");
  $("#dashboardContent").innerHTML=panel("Customer Management",`<div class="toolbar"><input id="customerSearch" placeholder="Search customer name or email"></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Registered</th><th>Status</th><th>Action</th></tr></thead><tbody id="customerRows">${users.map(u=>customerRow(u)).join("")}</tbody></table></div>`);
  $("#customerSearch").addEventListener("input",()=>{const q=$("#customerSearch").value.toLowerCase();$("#customerRows").innerHTML=users.filter(u=>`${u.name} ${u.email} ${u.username}`.toLowerCase().includes(q)).map(customerRow).join("");});
}
function customerRow(u){return `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${dateTime(u.createdAt)}</td><td>${statusBadge(u.active?"Active":"Inactive")}</td><td><button class="table-action" data-toggle-user="${u._id}" data-active="${u.active}">${u.active?"Deactivate":"Activate"}</button></td></tr>`;}
async function renderStaffAdmin() {
  const data=await api("/api/admin/users");const staff=data.users.filter(u=>u.role==="barber");
  $("#dashboardContent").innerHTML=`${panel("Create Barber Account",`<form id="barberForm" class="field-grid">
    <div class="field"><label>Full Name *</label><input id="barberName" required></div><div class="field"><label>Username *</label><input id="barberUsername" required minlength="3"></div>
    <div class="field"><label>Email *</label><input id="barberEmail" type="email" required></div><div class="field"><label>Contact Number</label><input id="barberPhone"></div>
    <div class="field"><label>Temporary Password (8+ chars) *</label><input id="barberPassword" type="password" required minlength="8"></div><div class="field"><button class="btn btn-pink" type="submit">Create Barber</button></div><p id="barberMessage" class="form-message full-row"></p></form>`)}
    ${panel("Barber Accounts",`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead><tbody>${staff.map(u=>`<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.phone||"—")}</td><td>${statusBadge(u.active?"Active":"Inactive")}</td><td><button class="table-action" data-toggle-user="${u._id}" data-active="${u.active}">${u.active?"Deactivate":"Activate"}</button></td></tr>`).join("")}</tbody></table></div>`)}`;
  $("#barberForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/admin/barbers",{method:"POST",body:{name:$("#barberName").value,username:$("#barberUsername").value,email:$("#barberEmail").value,phone:$("#barberPhone").value,password:$("#barberPassword").value}});showToast("Barber account created.");renderView("Staff");}catch(err){$("#barberMessage").textContent=err.message;$("#barberMessage").classList.add("error");}});
}
async function renderRevenueAdmin() {
  const rows=await loadReservations();
  const verified=rows.filter(r=>r.paymentStatus==="Verified");
  const completed=verified.filter(r=>r.status==="Completed");
  const pending=rows.filter(r=>r.paymentStatus==="Pending Verification");
  $("#dashboardContent").innerHTML=`<div class="notice">For this school-project version, the amounts below are calculated from recorded reservations and admin payment verification. They are not direct bank/e-wallet settlement data.</div>
  <div class="stats-grid">${statCard("Verified Payments",money(verified.reduce((a,r)=>a+r.servicePrice,0)))}${statCard("Completed-Service Revenue",money(completed.reduce((a,r)=>a+r.servicePrice,0)))}${statCard("Pending Verification",pending.length)}${statCard("Completed Reservations",completed.length)}</div>
  ${panel("Recorded transactions",reservationTable(rows,true),`<button class="btn btn-secondary btn-small" id="exportCsv">Export CSV</button>`)}`;
  $("#exportCsv").addEventListener("click",()=>downloadCsv(rows));
}
function downloadCsv(rows) {
  const values=[["Reservation ID","Customer","Service","Barber","Appointment","Price","Payment Method","Payment Status","Reservation Status"],...rows.map(r=>[r.reservationCode,r.customer?.name||"",r.serviceName,r.barber?.name||"",dateTime(r.appointmentDate),r.servicePrice,r.paymentMethod,r.paymentStatus,r.status])];
  const csv=values.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));a.download="barbershop-reservations.csv";a.click();URL.revokeObjectURL(a.href);
}
function openModal(html) {
  $("#modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal">${html}<div class="form-actions"><button class="btn btn-secondary" id="closeModal">Close</button></div></div></div>`;
}
async function viewReservation(id) {
  try {
    const {reservation:r}=await api(`/api/reservations/${id}`);
    const isAdmin=state.user.role==="admin",isBarber=state.user.role==="barber";
    let controls="";
    if(isAdmin){
      controls=`<div class="panel"><h3>Payment verification</h3><p>Current payment status: ${statusBadge(r.paymentStatus)}</p><div class="form-actions"><button class="btn btn-pink" data-payment-status="Verified" data-id="${r._id}">Verify Payment</button><button class="btn btn-danger" data-payment-status="Rejected" data-id="${r._id}">Reject Payment</button></div></div>
      <div class="panel"><h3>Reservation approval</h3><p>Current reservation status: ${statusBadge(r.status)}</p><div class="form-actions"><button class="btn btn-pink" data-reservation-status="Confirmed" data-id="${r._id}">Confirm</button><button class="btn btn-secondary" data-reservation-status="Rejected" data-id="${r._id}">Reject Reservation</button><button class="btn btn-secondary" data-reservation-status="Pending Approval" data-id="${r._id}">Set Pending Approval</button></div></div>`;
    } else if(isBarber) {
      controls=`<div class="panel"><h3>Update appointment</h3><div class="form-actions">${["In Progress","Completed","Cancelled"].map(s=>`<button class="btn btn-pink" data-reservation-status="${s}" data-id="${r._id}">${s}</button>`).join("")}</div></div>`;
    }
    openModal(`<h3>Reservation ${escapeHtml(r.reservationCode)}</h3><div class="summary-list">
      <div class="summary-row"><span>Customer</span><span>${escapeHtml(r.customer?.name||"—")}</span></div>
      <div class="summary-row"><span>Email</span><span>${escapeHtml(r.customer?.email||"—")}</span></div>
      <div class="summary-row"><span>Service</span><span>${escapeHtml(r.serviceName)}</span></div>
      <div class="summary-row"><span>Barber</span><span>${escapeHtml(r.barber?.name||"Not assigned")}</span></div>
      <div class="summary-row"><span>Appointment</span><span>${dateTime(r.appointmentDate)}</span></div>
      <div class="summary-row"><span>Price</span><span>${money(r.servicePrice)}</span></div>
      <div class="summary-row"><span>Payment</span><span>${escapeHtml(r.paymentMethod)} · ${escapeHtml(r.paymentStatus)}</span></div>
      <div class="summary-row"><span>Status</span><span>${escapeHtml(r.status)}</span></div>
      <div class="summary-row"><span>Notes</span><span>${escapeHtml(r.customerNotes||"—")}</span></div>
    </div><div class="form-actions"><button class="btn btn-secondary" data-show-proof="${r._id}">View Payment Proof</button></div>${controls}`);
  } catch(err) {showToast(err.message,true);}
}
async function showProof(id) {
  try{
    const data=await api(`/api/reservations/${id}/proof`);
    openModal(`<h3>Payment proof — ${escapeHtml(data.reservationCode)}</h3>${data.paymentProof?.dataUrl?`<img src="${data.paymentProof.dataUrl}" alt="Uploaded payment receipt">`:`<p class="muted">No receipt was uploaded.</p>`}<p class="muted">${escapeHtml(data.paymentProof?.filename||"")}</p>`);
  }catch(err){showToast(err.message,true);}
}
async function updateReservation(id,body) {
  try{const data=await api(`/api/reservations/${id}/status`,{method:"PATCH",body});showToast(data.message);$("#modalRoot").innerHTML="";await renderView(state.currentView);}catch(err){showToast(err.message,true);}
}
async function toggleUser(id,active) {
  try{await api(`/api/admin/users/${id}`,{method:"PATCH",body:{active:!active}});showToast(`Account ${active?"deactivated":"activated"}.`);renderView(state.currentView);}catch(err){showToast(err.message,true);}
}
async function deactivateService(id) {
  try{await api(`/api/services/${id}`,{method:"DELETE"});showToast("Service deactivated.");renderView("Services");}catch(err){showToast(err.message,true);}
}

document.addEventListener("click", async e => {
  const viewBtn=e.target.closest("[data-view]");
  if(viewBtn){if(state.token){try{const d=await api("/api/profile");state.user=d.user;showDashboard();renderView(state.user.role==="customer"?"New Reservation":"Dashboard");}catch{showAuth("login");}}else showAuth("login");}
  const dashBtn=e.target.closest("[data-dash-view]");
  if(dashBtn){const view=dashBtn.dataset.dashView;if(view==="Dashboard"||view==="New Reservation"||view==="My Reservations"||view==="Reservations"||view==="My Schedule"||view==="My Profile"||view==="Notifications"||view==="Services"||view==="Customers"||view==="Staff"||view==="Revenue"){renderView(view);}}
  const book=e.target.closest("[data-book-service]");
  if(book){if(state.token){try{const d=await api("/api/profile");state.user=d.user;showDashboard();renderView("New Reservation");setTimeout(()=>{if($("#bookingService"))$("#bookingService").value=book.dataset.bookService;$("#bookingService")?.dispatchEvent(new Event("change"));},80);}catch{showAuth("login");}}else showAuth("login");}
  const reservation=e.target.closest("[data-view-reservation]");if(reservation)viewReservation(reservation.dataset.viewReservation);
  const cancel=e.target.closest("[data-cancel-reservation]");if(cancel&&confirm("Cancel this reservation? The history record will be preserved.")){try{await api(`/api/reservations/${cancel.dataset.cancelReservation}/cancel`,{method:"PATCH",body:{reason:"Cancelled by customer"}});showToast("Reservation cancelled.");renderView(state.currentView);}catch(err){showToast(err.message,true);}}
  const pay=e.target.closest("[data-payment-status]");if(pay)updateReservation(pay.dataset.id,{paymentStatus:pay.dataset.paymentStatus});
  const rs=e.target.closest("[data-reservation-status]");if(rs)updateReservation(rs.dataset.id,{status:rs.dataset.reservationStatus});
  const proof=e.target.closest("[data-show-proof]");if(proof)showProof(proof.dataset.showProof);
  const toggle=e.target.closest("[data-toggle-user]");if(toggle)toggleUser(toggle.dataset.toggleUser,toggle.dataset.active==="true");
  const deact=e.target.closest("[data-deactivate-service]");if(deact&&confirm("Deactivate this service? Existing reservation history will be preserved."))deactivateService(deact.dataset.deactivateService);
  const read=e.target.closest("[data-read-notification]");if(read){try{await api(`/api/notifications/${read.dataset.readNotification}/read`,{method:"PATCH"});renderView("Notifications");}catch(err){showToast(err.message,true);}}
  if(e.target.id==="closeModal"||e.target.id==="modalBackdrop")$("#modalRoot").innerHTML="";
});
$("#menuToggle")?.addEventListener("click",()=>$("#mainNav")?.classList.toggle("open"));
$("#dashMenuToggle")?.addEventListener("click",()=>$("#dashboardNav")?.classList.toggle("show"));
$("#backToSite")?.addEventListener("click",showPublic);
$("#showRegister")?.addEventListener("click",()=>showAuth("register"));
$("#showLogin")?.addEventListener("click",()=>showAuth("login"));
$("#loginForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#loginMessage");msg.textContent="Signing in…";msg.classList.remove("error");
  try{const result=await api("/api/auth/login",{method:"POST",body:{login:$("#loginKey").value,password:$("#loginPassword").value}});state.token=result.token;state.user=result.user;localStorage.setItem("kpb_token",state.token);location.href=pageForRole(state.user.role);}
  catch(err){msg.textContent=err.message;msg.classList.add("error");}
});
$("#registerForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#registerMessage");msg.textContent="Creating account…";msg.classList.remove("error");
  try{const result=await api("/api/auth/register",{method:"POST",body:{name:$("#regName").value,username:$("#regUsername").value,email:$("#regEmail").value,phone:$("#regPhone").value,password:$("#regPassword").value}});msg.textContent=result.message;showToast(result.message);$("#registerForm").reset();setTimeout(()=>showAuth("login"),800);}
  catch(err){msg.textContent=err.message;msg.classList.add("error");}
});
$("#logoutBtn")?.addEventListener("click",()=>{if(confirm("Are you sure you want to log out?")){localStorage.removeItem("kpb_token");state.token="";state.user=null;location.href="index.html";}});
document.addEventListener("DOMContentLoaded",async()=>{
  if ($("#year")) $("#year").textContent=new Date().getFullYear();
  if ($("#publicServices")) {
    try{
      const s=await fetch(`${API_URL}/api/services`);
      if(s.ok){const d=await s.json();state.services=d.services||[];renderPublicServices();}
      else $("#publicServices").innerHTML='<p class="muted">Services will appear when the API is connected and an admin has added them.</p>';
    }catch{$("#publicServices").innerHTML='<p class="muted">Connect the backend and add services to display the live service menu.</p>';}
  }
  if(state.token){
    try{
      const d=await api("/api/profile");state.user=d.user;
      if (currentPageRole() === "public") location.href=pageForRole(state.user.role);
      else if (currentPageRole() !== state.user.role) location.href=pageForRole(state.user.role);
      else showDashboard();
    } catch {
      localStorage.removeItem("kpb_token");state.token="";
      if (currentPageRole() !== "public") location.href="index.html";
    }
  } else if (currentPageRole() !== "public") {
    location.href="index.html";
  }
});
