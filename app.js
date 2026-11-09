(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cfg = window.FIREBASE_CONFIG || {};
  const roleEmails = window.ROLE_EMAILS || {};
  const configReady = cfg.apiKey && !cfg.apiKey.startsWith("PASTE_") &&
    cfg.projectId && !cfg.projectId.startsWith("PASTE_");
  let auth, db, currentUser, role, watchId = null, stopTimer = null;
  let map, marker, lastPoint = null, unsubscribe = null, batteryManager = null;
  const TRACKER = "main";
  const HISTORY_MS = 7 * 24 * 60 * 60 * 1000;

  function showError(message) { $("loginError").textContent = message; }
  function setPill(el, text, state="muted") { el.textContent=text; el.className=`pill ${state}`; }
  function dateText(ms) { return ms ? new Date(ms).toLocaleString() : "—"; }
  function distanceMeters(a,b) {
    const R=6371000, rad=x=>x*Math.PI/180;
    const dLat=rad(b.lat-a.lat), dLon=rad(b.lng-a.lng);
    const x=Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }
  function prettyDistance(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`; }

  if (!configReady || !window.firebase) {
    $("loginError").textContent = "Setup required: add your Firebase web configuration in firebase-config.js, then reload.";
    $("loginForm").querySelector("button").disabled = true;
    return;
  }
  try {
    firebase.initializeApp(cfg);
    auth=firebase.auth(); db=firebase.firestore();
    auth.onAuthStateChanged(user => {
      if (user) enterApp(user);
      else resetApp();
    });
  } catch(e) { showError("Firebase initialization failed. Check firebase-config.js."); }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); showError("");
    const chosenRole=$("loginRole").value, email=$("email").value.trim(), password=$("password").value;
    if (email.toLowerCase() !== String(roleEmails[chosenRole]||"").toLowerCase()) {
      showError("This email is not configured for the selected account role."); return;
    }
    try { await auth.signInWithEmailAndPassword(email,password); }
    catch(err) { showError("Sign-in failed. Check the account email/password and Firebase Authentication setup."); }
  });
  $("logoutBtn").onclick=()=>auth.signOut();
  $("startBtn").onclick=startSharing;
  $("stopBtn").onclick=()=>stopSharing(true);
  $("refreshBtn").onclick=loadViewerData;
  $("directionsBtn").onclick=()=>{
    if(lastPoint) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lastPoint.lat},${lastPoint.lng}`,"_blank","noopener");
  };
  $("distanceBtn").onclick=calculateDistance;

  function resetApp() {
    stopSharing(false);
    if(unsubscribe){unsubscribe();unsubscribe=null;}
    currentUser=null; role=null;
    $("loginView").hidden=false; $("appView").hidden=true;
    setPill($("connectionPill"),"Not signed in");
  }
  async function enterApp(user) {
    currentUser=user;
    const selected=$("loginRole").value;
    const email=user.email.toLowerCase();
    role = email===String(roleEmails.provider).toLowerCase() ? "provider" :
           email===String(roleEmails.viewer).toLowerCase() ? "viewer" : null;
    if(!role){await auth.signOut();showError("This account is not authorized for this application.");return;}
    $("loginView").hidden=true; $("appView").hidden=false;
    $("providerPanel").hidden=role!=="provider";
    $("viewerPanel").hidden=role!=="viewer";
    $("roleLabel").textContent=role==="provider"?"LOCATION PROVIDER":"LOCATION VIEWER";
    $("hello").textContent=role==="provider"?"Hello, SUBHAJIT.":"Hello, INFO_SUBHAJIT.";
    setPill($("connectionPill"),"Authenticated","good");
    if(role==="provider"){ await cleanOldHistory(); updateBattery(); }
    else { initMap(); subscribeViewer(); makeQr(); }
    loadHistory();
  }

  function trackerRef(){return db.collection("trackers").doc(TRACKER);}
  function historyRef(){return trackerRef().collection("history");}

  async function startSharing() {
    if(role!=="provider" || !currentUser) return;
    if(!navigator.geolocation){$("gpsStatus").textContent="GPS unavailable";return;}
    if(!window.isSecureContext){$("gpsStatus").textContent="HTTPS required";return;}
    $("startBtn").disabled=true;
    $("gpsStatus").textContent="Requesting permission…";
    try {
      const initial=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
      await publishPosition(initial);
      watchId=navigator.geolocation.watchPosition(publishPosition, err=>{
        $("gpsStatus").textContent=err.code===1?"Permission denied":"GPS temporarily unavailable";
      },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
      await trackerRef().set({sharing:true,providerUid:currentUser.uid,startedAt:Date.now(),updatedAt:Date.now()},{merge:true});
      setPill($("sharingPill"),"Sharing","good");
      $("gpsStatus").textContent="Location active";
      $("stopBtn").disabled=false;
      const mins=Number($("duration").value);
      if(stopTimer)clearTimeout(stopTimer);
      if(mins>0)stopTimer=setTimeout(()=>stopSharing(true),mins*60000);
    } catch(err) {
      $("gpsStatus").textContent=err.code===1?"Location permission denied":"Could not start location";
      $("startBtn").disabled=false;
    }
  }
  async function publishPosition(position) {
    if(!currentUser || role!=="provider")return;
    const p={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,
      timestamp:Date.now(),providerUid:currentUser.uid};
    lastPoint=p;
    try {
      await trackerRef().set({sharing:true,providerUid:currentUser.uid,location:p,updatedAt:p.timestamp},{merge:true});
      await historyRef().doc(String(p.timestamp)).set(p);
      $("providerUpdated").textContent=dateText(p.timestamp);
      $("gpsStatus").textContent=`±${Math.round(p.accuracy)} m accuracy`;
      loadHistory();
    } catch(e) { $("gpsStatus").textContent="Database update failed"; }
  }
  async function stopSharing(userAction) {
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
    if(stopTimer){clearTimeout(stopTimer);stopTimer=null;}
    if($("startBtn"))$("startBtn").disabled=false;
    if($("stopBtn"))$("stopBtn").disabled=true;
    if($("sharingPill"))setPill($("sharingPill"),"Stopped","bad");
    if($("gpsStatus"))$("gpsStatus").textContent="Not sharing";
    if(userAction && currentUser && role==="provider"){
      try{await trackerRef().set({sharing:false,providerUid:currentUser.uid,stoppedAt:Date.now(),updatedAt:Date.now()},{merge:true});}
      catch(e){$("gpsStatus").textContent="Stopped locally; server update failed";}
    }
  }
  async function updateBattery(){
    if(!navigator.getBattery){$("batteryStatus").textContent="Not supported by browser";return;}
    try{
      batteryManager=await navigator.getBattery();
      const render=()=>{$("batteryStatus").textContent=`${Math.round(batteryManager.level*100)}%${batteryManager.charging?" · Charging":""}`;};
      render();batteryManager.addEventListener("levelchange",render);batteryManager.addEventListener("chargingchange",render);
    }catch(e){$("batteryStatus").textContent="Unavailable";}
  }
  async function cleanOldHistory(){
    try{
      const cutoff=Date.now()-HISTORY_MS;
      const old=await historyRef().where("timestamp","<",cutoff).limit(300).get();
      if(old.size){const batch=db.batch();old.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
    }catch(e){/* Cleanup is best-effort; rules may restrict it. */}
  }
  function initMap(){
    if(map)return;
    map=L.map("map").setView([22.5726,88.3639],5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  }
  function subscribeViewer(){
    if(unsubscribe)unsubscribe();
    unsubscribe=trackerRef().onSnapshot(doc=>{
      if(!doc.exists){renderNoLocation();return;}
      const data=doc.data(), p=data.location;
      $("viewerSharing").textContent=data.sharing?"Sharing":"Stopped";
      if(!p || typeof p.lat!=="number" || typeof p.lng!=="number"){renderNoLocation();return;}
      lastPoint=p;
      const age=Date.now()-Number(p.timestamp||data.updatedAt||0);
      const fresh=age<2*60*1000;
      setPill($("freshnessPill"),fresh?"Recently updated":"Delayed / stale",fresh?"good":"bad");
      $("accuracy").textContent=`±${Math.round(p.accuracy||0)} m`;
      $("viewerUpdated").textContent=dateText(p.timestamp);
      $("coordinates").textContent=`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
      if(!marker){marker=L.marker([p.lat,p.lng]).addTo(map).bindPopup("Shared location");}
      else marker.setLatLng([p.lat,p.lng]);
      map.setView([p.lat,p.lng],15);
      $("directionsBtn").disabled=false;
      if(!data.sharing)setPill($("freshnessPill"),"Sharing stopped","bad");
    },err=>{setPill($("freshnessPill"),"Access error","bad");});
  }
  function renderNoLocation(){
    $("accuracy").textContent="—";$("viewerUpdated").textContent="—";$("coordinates").textContent="No location available";
    $("directionsBtn").disabled=true;setPill($("freshnessPill"),"No location","muted");
  }
  async function loadViewerData(){if(role==="viewer"){try{const d=await trackerRef().get();if(d.exists){const p=d.data().location;if(p)lastPoint=p;}}catch(e){}}loadHistory();}
  async function loadHistory(){
    if(!currentUser)return;
    try{
      const snap=await historyRef().orderBy("timestamp","desc").limit(50).get();
      const cutoff=Date.now()-HISTORY_MS;
      const rows=snap.docs.map(d=>d.data()).filter(p=>p.timestamp>=cutoff);
      $("historyList").innerHTML=rows.length?rows.map(p=>`<div class="history-item"><strong>${new Date(p.timestamp).toLocaleString()}</strong><span>${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</span></div>`).join(""):'<p class="muted">No location history in the last 7 days.</p>';
    }catch(e){$("historyList").innerHTML='<p class="muted">History unavailable. Check Firestore rules and index setup.</p>';}
  }
  async function calculateDistance(){
    if(!lastPoint){$("distance").textContent="No shared location";return;}
    $("distance").textContent="Requesting permission…";
    navigator.geolocation.getCurrentPosition(pos=>{
      const d=distanceMeters({lat:pos.coords.latitude,lng:pos.coords.longitude},lastPoint);
      $("distance").textContent=prettyDistance(d);
    },()=>{$("distance").textContent="Permission denied or location unavailable";},{enableHighAccuracy:true,timeout:12000});
  }
  function makeQr(){
    const node=$("qrCode");node.innerHTML="";
    if(window.QRCode)new QRCode(node,{text:location.origin+location.pathname+"?view=1",width:150,height:150});
    else node.textContent="QR library unavailable.";
  }
  if("serviceWorker" in navigator && location.protocol!=="file:"){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  }
})();