(function () {
  var service_id = 10;

  var services = [];
  var stats    = [];

  function addURL(url) {
    if (url === "") {
      return; // empty, ignore
    }
    var found = services.reduce((found, service) => found || (service.url === url), false);
    if (found) return;
    try {
      var u = new URL(url);
    } catch (e) { console.log(e); return;}
    var service = {url: url, id: service_id++};
    services.push(service);
    createStat(service);
    if (services.length == 1) {
      // start the monitoring
      setInterval(refreshServices, 1000 * 60); // every minute
    }
    refreshServices();
  }

  var params = (new URL(window.location)).searchParams;
  if (params.get("services") !== null) {
    window.addEventListener("load", e => params.get("services").split(';').forEach(s => addURL(s)));
  }

  function createStat(service) {
    var body = document.getElementById("services");
    var frag = document.createDocumentFragment();
    var div = frag.appendChild(document.createElement("div"));
    div.appendChild(document.createElement("h2")).textContent = service.url;
    var p = div.appendChild(document.createElement("p")).appendChild(document.createElement("span"));
    p.textContent = "OK";
    p.style = "color: white; font-weight: bold; padding: 0.5ex;"
    p.id = "service-" + service.id;
    body.appendChild(frag);
  }
  var canNotify = (Notification.permission === "granted");
  if (!canNotify && Notification.permission !== "denied") {
    Notification.requestPermission(p => canNotify = (p === "granted"));
  }
  function notify(service, stat) {
    if (canNotify) {
      new Notification("Service " + service.url + " needs attention!",
                        {renotify: false, requireInteraction: true, tag: service.url});
    }
  }

  function updateStat(service, stat, ok) {
    var elt = document.getElementById("service-" + service.id);
    elt.textContent = stat;
    if (ok) {
      elt.style.backgroundColor = "green";
    } else {
      elt.style.backgroundColor = "red";
      notify(service, stat);
    }
  }
  function formatSeconds(seconds) {
    var ret = "";
    const DAYS = (60 * 60 *24);
    const HOURS = (60 * 60);
    var d = Math.floor(seconds / DAYS);
    seconds = seconds % DAYS;
    var h = Math.floor(seconds / HOURS);
    seconds = seconds % HOURS;
    var m = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    if (d !== 0) {
      ret = d + " day" + ((d>1)?"s":"");
    }
    if (h !== 0) {
      ret += " " + h + " hour" + ((h>1)?"s":"");
    }
    if (m !== 0) {
      ret += " " + m + " minute" + ((m>1)?"s":"");
    }
    if (h !== 0) {
      ret += " " + seconds + " second" + ((seconds>1)?"s":"");
    }
    return ret;
  }
  function statPrettyPrint(stat) {
    var ret = "uptime: " + formatSeconds(stat.uptime);
    if (stat.requests !== undefined) {
      ret += " total requests: " + stat.requests.total;
    }
    return ret;
  }

  function refreshServices() {
    services.forEach(service => {
      fetch(service.url + "/usage").then(stat => stat.json()).then(stat => {
        updateStat(service, statPrettyPrint(stat), true);
      }).catch(e => updateStat(service, e, false));
    })
  }

  // set up
  window.monitor = {};
  window.monitor.addURL = addURL;
})();
