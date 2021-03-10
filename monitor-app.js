(function () {
  let service_id = 10;

  let services = [];
  let stats = [];

  class Graph {
    constructor(selector, tracks, options) {
      this.options = Object.assign({}, options);
      if (!this.options.ticks) this.options.ticks = 360;
      this.tracks = [];
      for (let index = 0; index < tracks.length; index++) {
        const track = tracks[index];
        const newtrack = Object.assign({}, track);
        if (!newtrack.format) newtrack.format = (x) => x;
        if (!newtrack.title) newtrack.title = "Unknown";
        if (!newtrack.update) newtrack.update = (data) => [data.current, data.total];
        newtrack.data = d3.range(this.options.ticks).map(() => 0);
        newtrack.color = d3.schemeSet1[index];
        this.tracks.push(newtrack);
      }

      const margin = { top: 0, right: 0, bottom: 0, left: 0 },
        width = (this.options.ticks * 2) - margin.right,
        height = 100 - margin.top - margin.bottom;

      const x = this.x = d3.scaleLinear()
        .domain([0, this.options.ticks - 1])
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([0, 1])
        .range([height, 0]);

      for (const track of this.tracks) {
        track.line = d3.line()
          .x(function (d, i) { return x(i); })
          .y(function (d, i) { return y(d); });
      }

      const graph = d3.select(selector).append("section").attr("class", "live-graph");

      const svg = graph.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      const liveGraph = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      liveGraph.append("rect")
        .attr("width", width)
        .attr("height", height);

      liveGraph.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

      for (let index = 0; index < this.tracks.length; index++) {
        const track = this.tracks[index];
        track.text = liveGraph.append("text").attr("class", "title")
          .attr("x", 10)
          .attr("y", height - ((height / (this.tracks.length * 2)) * index) - 10)
          .attr("fill", track.color)
          .text(track.title);
      }

      const clip = liveGraph.append("g")
        .attr("clip-path", "url(#clip)");
      for (const track of this.tracks) {
        track.path = clip.append("path")
          .datum(track.data)
          .attr("class", "line")
          .attr("stroke", track.color)
          .attr("d", track.line);
      }
    }

    update(data) {
      for (const track of this.tracks) {
        try {
          const d = track.update(data);
          track.data.push(d[0] / d[1]);
          track.path
            .attr("d", track.line)
            .attr("transform", null)
            .attr("transform", "translate(" + this.x(-1) + ")");
          track.data.shift();
          track.text.text(`${track.title}: ${track.format(d[0])} / ${track.format(d[1])} (${Math.round((d[0] / d[1]) * 10000) / 100}%)`)
        } catch (err) {
          // console.error(err);
        }
      }
    }
  }

  function addURL(url) {
    if (url === "") {
      return; // empty, ignore
    }
    let found = services.reduce((found, service) => found || (service.url === url), false);
    if (found) return;
    try {
      let u = new URL(url);
    } catch (e) { console.error(e); return; }
    fetch(url + "/usage").then(stat => stat.json()).then(usage => {
      let service = { url: url, name: usage.name, id: service_id++ };
      services.push(service);
      createStat(service, !!usage.GitHub);
      if (services.length == 1) {
        // start the monitoring
        setInterval(refreshServices, 1000 * 60); // every minute
      }
      refreshServices();
    }).catch(console.error);
  }

  let params = (new URL(window.location)).searchParams;
  if (params.get("services") !== null) {
    window.addEventListener("load", e => params.get("services").split(';').forEach(s => addURL(s)));
  }

  function nudge(url) {
    fetch(url + "/../docs/nudge").then(res => {
      if (res.ok) {
        fetch(url + '/../nudge', {
          method: 'POST',
          mode: 'same-origin',
          cache: 'no-cache',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json'
          },
          redirect: 'error',
          referrer: 'no-referrer',
          body: JSON.stringify({ nudge: true })
        })
      }
    });
  }

  function createStat(service, withGitHub) {
    let body = document.getElementById("services");
    let frag = document.createDocumentFragment();
    let div = frag.appendChild(document.createElement("div"));
    div.appendChild(document.createElement("h2")).textContent = service.url;
    let anchor = div.appendChild(document.createElement("p"));
    anchor.innerHTML = "<a href='" + service.url + "/logs'>logs</a>"
      + ", <a href='" + service.url + "/usage'>usage</a>"
      + ", <a href='" + service.url + "/../doc/nudge'>nudge</a>";
    let span = div.appendChild(document.createElement("p")).appendChild(document.createElement("span"));
    span.textContent = "OK";
    span.style = "color: white; font-weight: bold; padding: 0.5ex;"
    span.id = "service-" + service.id;
    const tracks = [
      {
        title: `${service.name} (Heap)`,
        format: (x) => `${Math.round(x/10000)/100}Mb`,
        update: (usage) => [usage.heapUsed, usage.heapTotal]
      }];
    if (withGitHub) {
      tracks.push({
        title: "GitHub limit",
        update: (usage) => [usage.GitHub.rate.limit-usage.GitHub.rate.remaining, usage.GitHub.rate.limit]
      });
    }
    const g = new Graph("body", tracks);
    service.graph = g;
    body.appendChild(frag);
  }

  let canNotify = (Notification.permission === "granted");
  if (!canNotify && Notification.permission !== "denied") {
    Notification.requestPermission(p => canNotify = (p === "granted"));
  }
  function notify(service, stat) {
    if (canNotify) {
      new Notification("Service " + service.url + " needs attention!",
        { renotify: false, requireInteraction: true, tag: service.url });
    }
  }

  function updateStat(service, stat, ok) {
    let elt = document.getElementById("service-" + service.id);
    elt.textContent = stat;
    if (ok) {
      elt.style.backgroundColor = "green";
    } else {
      elt.style.backgroundColor = "red";
      notify(service, stat);
    }
  }
  function formatSeconds(seconds) {
    let ret = "";
    const DAYS = (60 * 60 * 24);
    const HOURS = (60 * 60);
    let d = Math.floor(seconds / DAYS);
    seconds = seconds % DAYS;
    let h = Math.floor(seconds / HOURS);
    seconds = seconds % HOURS;
    let m = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    if (d !== 0) {
      ret = d + " day" + ((d > 1) ? "s" : "");
    }
    if (h !== 0) {
      ret += " " + h + " hour" + ((h > 1) ? "s" : "");
    }
    if (m !== 0) {
      ret += " " + m + " minute" + ((m > 1) ? "s" : "");
    }
    if (h !== 0) {
      ret += " " + seconds + " second" + ((seconds > 1) ? "s" : "");
    }
    return ret;
  }
  function statPrettyPrint(stat) {
    let ret = "uptime: " + formatSeconds(stat.uptime);
    if (stat.requests !== undefined) {
      ret += " total requests: " + stat.requests.total;
      ret += " total errors: " + stat.requests.errors;
      ret += " total warnings: " + stat.requests.warnings;
    }
    return ret;
  }

  function refreshServices() {
//    update(g);
//    setInterval(() => update(g), 10000);

    services.forEach(service => {
      fetch(service.url + "/usage").then(stat => stat.json()).then(stat => {
        service.graph.update(stat);
        updateStat(service, statPrettyPrint(stat), true);
      }).catch(e => updateStat(service, e, false));
    })
  }

  // set up
  window.monitor = {};
  window.monitor.addURL = addURL;
  window.monitor.nudge = nudge;
})();
