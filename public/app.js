const API = "/api";
let token = localStorage.getItem("vendor_jwt") || null;
const $ = s => document.querySelector(s);
const showApp = () => { $("#login").classList.add("hide"); $("#app").classList.remove("hide"); };
const showLogin = () => { $("#app").classList.add("hide"); $("#login").classList.remove("hide"); };
if (token) showApp();

$("#login").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await fetch(`${API}/auth-login`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") })
  });
  const data = await r.json();
  if (!r.ok) return alert(data.error||"Login failed");
  token = data.token;
  if ($("#remember").checked) localStorage.setItem("vendor_jwt", token);
  showApp();
});

async function promptScan(){ return prompt("Enter/scan member ID from barcode:"); }

$("#scan").addEventListener("click", async ()=>{
  const member_id = $("#member").value || await promptScan();
  if (!member_id) return;
  const r = await fetch(`${API}/scan`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify({ member_id })
  });
  const data = await r.json();
  if (!r.ok) return alert(data.error||"Scan failed");
  $("#member").value = member_id;
  $("#balance").textContent = `Points: ${data.points}`;
  $("#status").textContent = "";
});

$("#earn").addEventListener("click", async ()=>{
  const member_id = $("#member").value;
  if (!member_id) return alert("Scan a card first");
  const amount = Number($("#amount").value||0);
  const r = await fetch(`${API}/earn`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify({ member_id, amount })
  });
  const data = await r.json();
  if (!r.ok) return alert(data.error||"Earn failed");
  $("#balance").textContent = `Points: ${data.new_points}`;
  $("#status").textContent = "Points added";
});

async function redeem(which){
  const member_id = $("#member").value;
  if (!member_id) return alert("Scan a card first");
  const r = await fetch(`${API}/redeem`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify({ member_id, reward: which })
  });
  const data = await r.json();
  if (!r.ok) return alert(data.error||"Redeem failed");
  $("#balance").textContent = `Points: ${data.new_points}`;
  $("#status").textContent = `Redeemed ${which}. Code: ${data.redemption_code}`;
}
$("#r50").addEventListener("click", ()=>redeem("5OFF"));
$("#r100").addEventListener("click", ()=>redeem("12OFF"));
