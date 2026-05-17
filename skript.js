/* ============================================================
   BALKONGTRÄDGÅRD – skript.js
   Detta ritar upp sidan utifrån datan i index.html.
   Du behöver normalt inte ändra något här.
   ============================================================ */
"use strict";

/* ---- Små hjälpfunktioner ---------------------------------- */

// Hämtar en temafärg, t.ex. C("accent") -> "#5a3e08"
function C(name){
  return getComputedStyle(document.body).getPropertyValue("--" + name).trim();
}

// Skapar ett element. el("div", {class:"card"}, [barn...] eller "text")
function el(tag, attrs, kids){
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs){
    const v = attrs[k];
    if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.slice(0,2) === "on") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (kids != null){
    (Array.isArray(kids) ? kids : [kids]).forEach(function(c){
      if (c == null || c === false) return;
      n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
  }
  return n;
}

// Ljusfärg och text utifrån "full"/"part"/"shade"
function lightColor(k){ return k==="full"?C("sunFull"):k==="part"?C("sunPart"):C("sunShade"); }
function lightLabel(k, short){
  if (k==="full") return "Full sol";
  if (k==="part") return "Halvskugga";
  return short ? "Sval" : "Sval/skugga";
}

// Liten färgad etikett (tag/chip)
function makeTag(text, color, bg){
  return el("span", { class:"tag", style:{ color:color, background:bg, borderColor:color+"66" } }, text);
}

// 3 prickar som visar hur bra en gödselmetod passar (Gödsling-fliken)
function makeDots(value, color){
  const wrap = el("span", { style:{ display:"inline-flex", gap:"3px" } });
  for (let i=1;i<=3;i++){
    wrap.appendChild(el("span", { style:{
      width:"7px", height:"7px", borderRadius:"50%",
      background: i<=value ? color : "transparent",
      border:"1.5px solid " + (i<=value ? color : color+"55"),
      display:"inline-block"
    }}));
  }
  return wrap;
}

// Gör en tabell med kolumner vars bredd går att dra i.
// cols = [{label, w, sortKey?, align?}]
// rows = lista, render(row, colKey) -> innehåll för varje cell
function buildTable(cols, rows, opts){
  opts = opts || {};
  const widths = cols.map(c => c.w);
  const tbl = el("div", { class:"tbl", style:{ minWidth: widths.reduce((a,b)=>a+b,0)+"px" } });
  const tmpl = () => widths.map(w => w+"px").join(" ");

  const head = el("div", { class:"tbl-head", style:{ gridTemplateColumns:tmpl() } });
  const body = el("div");

  let sortKey = opts.sortKey || null;
  let sortDir = "asc";
  let query = "";

  // Söker igenom alla värden i en rad efter söktexten.
  function matches(row){
    if (!query) return true;
    const q = query.toLowerCase();
    return Object.keys(row).some(function(k){
      const v = row[k];
      return v != null && String(v).toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderBody(){
    body.innerHTML = "";
    let data = rows.filter(matches);
    if (sortKey && opts.sortValue){
      data.sort(function(a,b){
        const x = opts.sortValue(a, sortKey), y = opts.sortValue(b, sortKey);
        return (x<y?-1:x>y?1:0) * (sortDir==="asc"?1:-1);
      });
    }
    if (data.length === 0){
      body.appendChild(el("div", { style:{ padding:"18px", textAlign:"center",
        color:C("inkMid"), fontSize:"12px", fontStyle:"italic" } },
        "Inga rader matchar \u201c" + query + "\u201d"));
      return;
    }
    data.forEach(function(row, i){
      const r = el("div", { class:"tbl-row alt"+(i%2), style:{ gridTemplateColumns:tmpl() } });
      cols.forEach(function(c){
        const cell = el("div", { style: c.align ? { textAlign:c.align } : null });
        const content = opts.render(row, c.key, c);
        if (content != null) cell.appendChild(typeof content === "object" ? content : document.createTextNode(String(content)));
        r.appendChild(cell);
      });
      body.appendChild(r);
    });
  }

  function renderHead(){
    head.innerHTML = "";
    head.style.gridTemplateColumns = tmpl();
    cols.forEach(function(c, i){
      const isSorted = sortKey === c.sortKey;
      const h = el("div", { class: isSorted ? "sorted" : "" });
      h.appendChild(el("span", { class:"ell", style:{ flex:"1" } }, c.label));
      if (c.sortKey){
        const arrow = isSorted ? (sortDir==="asc"?"↑":"↓") : "↕";
        h.appendChild(el("span", { class:"arrow"+(isSorted?" on":"") }, arrow));
        h.addEventListener("click", function(){
          if (sortKey === c.sortKey) sortDir = sortDir==="asc"?"desc":"asc";
          else { sortKey = c.sortKey; sortDir = "asc"; }
          renderHead(); renderBody();
        });
      }
      if (i < cols.length-1){
        const handle = el("div", { class:"resize-handle" }, el("div"));
        handle.addEventListener("mousedown", function(e){
          e.preventDefault(); e.stopPropagation();
          const startX = e.clientX, startW = widths[i];
          function move(me){
            widths[i] = Math.max(60, startW + (me.clientX - startX));
            tbl.style.minWidth = widths.reduce((a,b)=>a+b,0)+"px";
            head.style.gridTemplateColumns = tmpl();
            Array.prototype.forEach.call(body.children, function(rw){
              rw.style.gridTemplateColumns = tmpl();
            });
          }
          function up(){ window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up); }
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        });
        h.appendChild(handle);
      }
      head.appendChild(h);
    });
  }

  renderHead(); renderBody();
  tbl.appendChild(head); tbl.appendChild(body);

  const wrap = el("div", { class:"tbl-wrap" }, tbl);

  /* ── Fast tabellhuvud vid scroll ──────────────────────────────
     Ren CSS (position:sticky) fungerar inte här, eftersom wrappen
     har overflow-x:auto för sidledsscroll – det "fångar" sticky.
     Därför pinnar vi huvudet med JavaScript istället: när sidan
     scrollats förbi tabellens topp läggs en kopia av huvudet fast
     högst upp i fönstret, i exakt samma bredd och i takt med
     ev. sidledsscroll. Inget att ändra här för att redigera data. */
  let pinned = null;
  function syncPinned(){
    if (!pinned) return;
    // Rikta in mot wrappens kantlåda, klipp sidledsscrollen där
    const wr = wrap.getBoundingClientRect();
    pinned.style.left  = wr.left + "px";
    pinned.style.width = wr.width + "px";
    // Följ tabellens egen sidledsscroll
    pinned.firstChild.firstChild.style.marginLeft = (-wrap.scrollLeft) + "px";
  }
  function onScroll(){
    const wrapRect = wrap.getBoundingClientRect();
    const headH = head.getBoundingClientRect().height || 36;
    // Tabellens topp förbi fönsterkanten men botten fortfarande synlig
    const shouldPin = wrapRect.top < 0 && wrapRect.bottom > headH + 8;
    if (shouldPin && !pinned){
      // Yttre lager klipper sidledsscrollen
      pinned = el("div", { style:{ position:"fixed", top:"0", zIndex:"60",
        overflow:"hidden", pointerEvents:"none" } });
      // Inre lager bär samma ram som tabellen så strecket blir obrutet
      const framed = el("div", { style:{
        border:"1px solid " + C("border"),
        borderTopLeftRadius:"8px", borderTopRightRadius:"8px",
        overflow:"hidden",
        boxShadow:"0 2px 8px rgba(20,16,8,0.12)" } });
      const clone = head.cloneNode(true);
      clone.style.marginLeft = (-wrap.scrollLeft) + "px";
      framed.appendChild(clone);
      pinned.appendChild(framed);
      document.body.appendChild(pinned);
      syncPinned();
    } else if (!shouldPin && pinned){
      pinned.remove(); pinned = null;
    } else if (pinned){
      syncPinned();
    }
  }
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", function(){ if (pinned){ pinned.remove(); pinned=null; } onScroll(); });
  wrap.addEventListener("scroll", syncPinned);

  // Sökruta ovanför tabellen
  const searchBox = el("div", { class:"tbl-search" });
  const input = el("input", { type:"text", class:"tbl-search-input",
    placeholder: opts.searchPlaceholder || "Sök i tabellen\u2026" });
  const clearBtn = el("button", { class:"tbl-search-clear",
    "aria-label":"Rensa sökning", style:{ visibility:"hidden" } }, "\u2715");
  input.addEventListener("input", function(){
    query = input.value.trim();
    clearBtn.style.visibility = query ? "visible" : "hidden";
    renderBody();
  });
  clearBtn.addEventListener("click", function(){
    input.value = ""; query = "";
    clearBtn.style.visibility = "hidden";
    renderBody(); input.focus();
  });
  searchBox.appendChild(el("span", { class:"tbl-search-icon" }, "\uD83D\uDD0D"));
  searchBox.appendChild(input);
  searchBox.appendChild(clearBtn);

  return el("div", null, [searchBox, wrap]);
}

/* ---- FLIK: KARTA ------------------------------------------ */

function renderMapTab(){
  const pane = el("div", { class:"tab-pane" });
  let selected = null;

  // Förklaring (legend)
  const legend = el("div", { class:"legend-row" });
  [["full","Full sol"],["part","Halvskugga"],["shade","Sval/skugga"]].forEach(function(p){
    legend.appendChild(el("div", { class:"legend-item" }, [
      el("div", { class:"legend-dot", style:{ background:lightColor(p[0]) } }),
      p[1]
    ]));
  });
  legend.appendChild(el("div", { class:"hint" }, "Tryck på zon"));
  pane.appendChild(legend);

  const map = el("div", { class:"map" });
  const detailHolder = el("div");
  pane.appendChild(map);
  pane.appendChild(detailHolder);

  // En klickbar fyrkantig zon
  function zoneBox(o){
    const lc = o.light ? lightColor(o.light) : null;
    const box = el("div", { class:"zone"+(o.fixed?" fixed":"") });
    Object.assign(box.style, o.style);
    function paint(){
      const on = selected === o.id;
      box.style.background = on ? (lc?lc+"28":C("accentBg")) : o.fixed ? C("wallLight")+"aa" : C("greenBg");
      box.style.border = (on?2:1)+"px solid " + (on ? (lc||C("accent")) : lc?lc+"66":C("border"));
      box.style.boxShadow = on ? "0 0 0 3px "+(lc||C("accent"))+"22" : "none";
    }
    box.appendChild(el("div", { class:"z-label" }, o.label));
    if (o.sublabel) box.appendChild(el("div", { class:"z-sub" }, o.sublabel));
    if (o.tag) box.appendChild(el("div", { class:"z-tag", style:{ background:lc?lc+"22":C("accentBg"), color:lc||C("accent") } }, o.tag));
    if (!o.fixed && o.id){
      box.style.cursor = "pointer";
      box.addEventListener("click", function(){ selectZone(o.id); });
    }
    box._paint = paint; paint();
    return box;
  }

  // En klickbar rund kruka/zon
  function circle(o){
    const c = el("div", { class:"circle" });
    Object.assign(c.style, o.style);
    function paint(){
      const on = selected === o.id;
      const col = o.color;
      c.style.background = on ? col+"33" : (o.softBg || C("accentBg"));
      c.style.border = (on?2:1)+"px solid " + (on ? col : col+"66");
      c.style.boxShadow = on ? "0 0 0 3px "+col+"22" : "none";
    }
    (o.children||[]).forEach(function(ch){ c.appendChild(ch); });
    c.addEventListener("click", function(){ selectZone(o.id); });
    c._paint = paint; paint();
    return c;
  }

  function selectZone(id){
    selected = (selected === id) ? null : id;
    Array.prototype.forEach.call(map.querySelectorAll(".zone,.circle"), function(n){
      if (n._paint) n._paint();
    });
    renderDetail();
  }

  function renderDetail(){
    detailHolder.innerHTML = "";
    const d = selected ? ZONE_DETAILS[selected] : null;
    if (d){
      const lc = lightColor(d.light);
      const card = el("div", { class:"card", style:{ marginTop:"12px", borderColor:lc+"88" } });
      const top = el("div", { style:{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:"8px", flexWrap:"wrap", gap:"6px" } });
      top.appendChild(el("div", { style:{ fontSize:"14px", fontWeight:"700",
        color:C("ink"), fontFamily:"Georgia,serif", fontStyle:"italic" } }, d.label));
      top.appendChild(makeTag(lightLabel(d.light), lc, lc+"22"));
      card.appendChild(top);
      card.appendChild(el("div", { style:{ fontSize:"12px", color:C("inkMid"),
        marginBottom:"10px", fontStyle:"italic" } }, d.note));
      d.items.forEach(function(item){
        card.appendChild(el("div", { style:{ fontSize:"12px", color:C("ink"),
          padding:"5px 0", borderBottom:"1px solid "+C("border"), display:"flex", gap:"8px" } }, [
          el("span", { style:{ color:C("inkFaint"), flexShrink:"0" } }, "–"), item
        ]));
      });
      detailHolder.appendChild(card);
    }
    // Två info-rutor under kartan
    const grid = el("div", { class:"info-grid" });
    const c1 = el("div", { class:"card", style:{ borderLeft:"3px solid "+C("sunFull") } });
    c1.appendChild(el("div", { style:{ fontSize:"11px", fontWeight:"700", color:C("accent"), marginBottom:"4px" } }, "⚠ Räcket"));
    c1.appendChild(el("div", { style:{ fontSize:"11px", color:C("inkMid"), lineHeight:"1.6" } },
      "Vid kraftigt regn eller storm, flytta in krukorna som står längst räcket mot mitten av balkongen."));
    const c2 = el("div", { class:"card", style:{ borderLeft:"3px solid "+C("sunShade") } });
    c2.appendChild(el("div", { style:{ fontSize:"11px", fontWeight:"700", color:C("inkMid"), marginBottom:"4px" } }, "💡 Halvskugga"));
    c2.appendChild(el("div", { style:{ fontSize:"11px", color:C("inkMid"), lineHeight:"1.6" } },
      "Upphöjd låda vid dörren – perfekt för sallat som bränner i sommarsol."));
    grid.appendChild(c1); grid.appendChild(c2);
    detailHolder.appendChild(grid);
  }

  // ---- Bygg själva ritningen ----

  // Vänster husvägg
  map.appendChild(el("div", { class:"abs", style:{ top:"0", left:"0", width:"4%",
    height:"96%", background:C("wallDark"), borderRight:"2px solid "+C("wallBorder") } }));

  // Övre husvägg (höger om dörren)
  const topWall = el("div", { class:"abs", style:{ top:"0", left:"40%", right:"4%",
    height:"4.4%", background:C("wallDark"), borderBottom:"2px solid "+C("wallBorder"),
    display:"flex", alignItems:"center", justifyContent:"center" } });
  topWall.appendChild(el("span", { style:{ fontSize:"clamp(5px,1.1vw,8px)", letterSpacing:"0.18em",
    color:C("wallText"), textTransform:"uppercase", fontFamily:"monospace" } }, "husvägg"));
  map.appendChild(topWall);

  // Höger räcke (tunt, ljust)
  map.appendChild(el("div", { class:"abs", style:{ top:"4.4%", right:"0", width:"4%",
    height:"91.6%", background:C("mapBg"), borderLeft:"2px dashed "+C("wallBorder") } }));
  map.appendChild(el("div", { class:"map-label", style:{ top:"50%", right:"2%",
    transform:"translate(50%,-50%) rotate(90deg)", transformOrigin:"center center",
    fontSize:"clamp(5px,0.9vw,7px)" } }, "räcke"));

  // Husvägg-etikett vänster
  map.appendChild(el("div", { class:"map-label", style:{ top:"55%", left:"2%",
    transform:"translate(-50%,-50%) rotate(-90deg)", transformOrigin:"center center",
    fontSize:"clamp(5px,0.9vw,7px)", color:C("wallText") } }, "husvägg"));

  // Dörröppning
  const door = el("div", { class:"abs", style:{ top:"0", left:"4%", width:"36%",
    height:"4.4%", background:C("mapBg"), borderRight:"2px solid "+C("wallBorder"),
    borderBottom:"2px solid "+C("wallBorder"), display:"flex",
    alignItems:"center", justifyContent:"center" } });
  door.appendChild(el("div", { style:{ fontSize:"clamp(5px,0.8vw,7px)", color:C("inkFaint"),
    whiteSpace:"nowrap", fontFamily:"monospace", letterSpacing:"0.12em" } }, "DÖRRÖPPNING"));
  map.appendChild(door);

  // Dörrens öppningsbåge (SVG)
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox","0 0 100 100");
  svg.setAttribute("preserveAspectRatio","none");
  Object.assign(svg.style, { position:"absolute", top:"4.4%", left:"4%",
    width:"36%", height:"34%", pointerEvents:"none" });
  function svgLine(x1,y1,x2,y2){
    const l = document.createElementNS(svgNS,"line");
    l.setAttribute("x1",x1); l.setAttribute("y1",y1);
    l.setAttribute("x2",x2); l.setAttribute("y2",y2);
    l.setAttribute("stroke",C("wallBorder")); l.setAttribute("stroke-width","2");
    return l;
  }
  svg.appendChild(svgLine(0,0,100,0));
  svg.appendChild(svgLine(0,0,0,100));
  const arc = document.createElementNS(svgNS,"path");
  arc.setAttribute("d","M 100 0 A 100 100 0 0 1 0 100");
  arc.setAttribute("fill","none");
  arc.setAttribute("stroke",C("inkFaint"));
  arc.setAttribute("stroke-width","1.2");
  arc.setAttribute("stroke-dasharray","5,3");
  svg.appendChild(arc);
  map.appendChild(svg);

  // Soffa
  map.appendChild(zoneBox({ label:"Soffa", fixed:true,
    style:{ top:"5.6%", left:"42%", width:"40%", height:"20%" } }));

  // Gurkkrukor (2 cirklar)
  [{top:"5.6%"},{top:"15.6%"}].forEach(function(pos){
    map.appendChild(circle({ id:"gurkkrukor", color:C("sunFull"), softBg:C("accentBg"),
      style:{ top:pos.top, left:"84%", width:"7%" },
      children:[ el("span", { style:{ fontSize:"clamp(7px,1.2vw,10px)" } }, "🥒") ] }));
  });
  map.appendChild(el("div", { class:"abs", style:{ top:"24%", left:"82%", width:"13%",
    textAlign:"center", fontSize:"clamp(5px,0.8vw,7px)", color:C("inkMid"),
    fontStyle:"italic", lineHeight:"1.3", pointerEvents:"none" },
    html:"Gurka<br>(Vorgebr.)" }));

  // Insynsskydd
  map.appendChild(el("div", { class:"abs", style:{ top:"5.6%", left:"92.5%", width:"1.4%",
    height:"22%", background:"repeating-linear-gradient(180deg, "+C("borderDark")+" 0 6px, "+C("wallLight")+" 6px 10px)",
    borderRadius:"2px", boxShadow:"0 0 0 1px "+C("wallBorder"), pointerEvents:"none" } }));
  map.appendChild(el("div", { class:"abs", style:{ top:"29%", left:"85%", width:"14%",
    textAlign:"center", fontSize:"clamp(4px,0.75vw,7px)", color:C("inkMid"),
    fontStyle:"italic", lineHeight:"1.25", pointerEvents:"none" } }, "Insynsskydd"));

  // Bord
  map.appendChild(zoneBox({ label:"Bord", fixed:true,
    style:{ top:"34%", left:"54%", width:"16%", height:"15%" } }));

  // Upphöjd låda
  map.appendChild(zoneBox({ id:"bloomlada", label:"Upphöjd låda",
    sublabel:"Sallat · Dill · Persilja", tag:"full sol", light:"full",
    style:{ bottom:"5%", left:"5%", width:"19%", height:"50%" } }));

  // Pallkrage
  map.appendChild(zoneBox({ id:"pallkrage", label:"Pallkrage",
    sublabel:"Busktomat (Balkonzauber)", tag:"full sol", light:"full",
    style:{ bottom:"5%", left:"79%", width:"16%", height:"38%" } }));

  // Märgärt
  map.appendChild(zoneBox({ id:"plastlada", label:"Märgärt (Lincoln)",
    sublabel:"spaljé", tag:"halvskugga", light:"part",
    style:{ bottom:"5%", left:"25%", width:"18%", height:"10%" } }));

  // Växttorn
  map.appendChild(circle({ id:"vaxttorn", color:C("sunPart"), softBg:C("sunPart")+"12",
    style:{ bottom:"5%", left:"44%", width:"11%" },
    children:[
      el("span", { style:{ fontSize:"clamp(8px,1.4vw,11px)" } }, "🌀"),
      el("span", { style:{ fontSize:"clamp(5px,0.8vw,7px)", color:C("sunPart"),
        textAlign:"center", lineHeight:"1.2", fontStyle:"italic" }, html:"Växt-<br>torn" })
    ] }));

  // Terrakottakrukor (5 cirklar)
  [{b:"12%",l:"56%"},{b:"12%",l:"62.5%"},{b:"12%",l:"69%"},{b:"5%",l:"59%"},{b:"5%",l:"66%"}].forEach(function(p){
    map.appendChild(circle({ id:"smakrukor", color:C("sunPart"), softBg:C("sunPart")+"12",
      style:{ bottom:p.b, left:p.l, width:"6%" },
      children:[ el("span", { style:{ fontSize:"clamp(5px,0.9vw,8px)" } }, "🪴") ] }));
  });
  map.appendChild(el("div", { class:"abs", style:{ bottom:"19%", left:"55%", width:"21%",
    textAlign:"center", fontSize:"clamp(5px,0.7vw,7px)", color:C("sunPart"),
    fontStyle:"italic", pointerEvents:"none" } }, "krukor"));

  // Nedre räcke
  const botRail = el("div", { class:"abs", style:{ bottom:"0", left:"4%", right:"4%",
    height:"4%", background:C("mapBg"), borderTop:"2px dashed "+C("wallBorder"),
    display:"flex", alignItems:"center", justifyContent:"center" } });
  botRail.appendChild(el("span", { style:{ fontSize:"clamp(5px,0.9vw,7px)", letterSpacing:"0.18em",
    color:C("inkMid"), fontFamily:"monospace", textTransform:"uppercase" } }, "räcke"));
  map.appendChild(botRail);

  renderDetail();
  return pane;
}

/* ---- FLIK: PLANTOR ---------------------------------------- */

function renderPlantsTab(){
  const pane = el("div", { class:"tab-pane" });

  const legend = el("div", { class:"legend-row" });
  legend.appendChild(makeTag("Förkultiverad", C("green"), C("greenBg")));
  legend.appendChild(makeTag("Direktsådd", C("accent"), C("accentBg")));
  legend.appendChild(el("span", { class:"hint" }, "Dra kolumnkant för att ändra bredd"));
  pane.appendChild(legend);

  const cols = [
    { key:"name",   label:"Växt",         w:160, sortKey:"name" },
    { key:"type",   label:"Typ",          w:74,  sortKey:"type" },
    { key:"light",  label:"Ljus",         w:80,  sortKey:"light" },
    { key:"avhard", label:"Avhärdning",   w:90,  sortKey:"avhard", align:"center" },
    { key:"date",   label:"Utplantering", w:100, sortKey:"date",   align:"center" },
    { key:"sow",    label:"Direktsådd",   w:100, sortKey:"sow",    align:"right" },
  ];

  function sortValue(p, key){
    if (key==="date" || key==="sow") return p.dateOrder;
    if (key==="avhard") return p.avhardOrder;
    if (key==="name") return p.name.toLowerCase();
    if (key==="type") return p.type==="pre"?0:1;
    return p.light==="full"?0:p.light==="part"?1:2; // light
  }

  function render(p, key){
    if (key==="name"){
      const box = el("div");
      const top = el("div", { style:{ fontSize:"12px", fontWeight:"600", color:C("ink"),
        fontFamily:"Georgia,serif", fontStyle:"italic", display:"flex", gap:"6px", alignItems:"center" } });
      top.appendChild(el("span", { style:{ fontSize:"15px", flexShrink:"0" } }, p.emoji));
      top.appendChild(el("span", { class:"ell", style:{ color:C("ink") } }, p.name));
      box.appendChild(top);
      box.appendChild(el("div", { style:{ paddingLeft:"21px", marginTop:"2px" } },
        el("span", { class:"ell", style:{ color:C("inkMid"), fontSize:"10px" } }, p.variety)));
      return box;
    }
    if (key==="type"){
      const pre = p.type==="pre";
      return makeTag(pre?"Förk.":"Direkt", pre?C("green"):C("accent"), pre?C("greenBg"):C("accentBg"));
    }
    if (key==="light"){
      const wrap = el("div", { style:{ display:"flex", flexDirection:"column",
        alignItems:"center", gap:"3px" } });
      wrap.appendChild(el("div", { style:{ width:"8px", height:"8px", borderRadius:"50%",
        background:lightColor(p.light), flexShrink:"0" } }));
      wrap.appendChild(el("div", { class:"ell", style:{ fontSize:"9px",
        color:lightColor(p.light), textAlign:"center" } }, lightLabel(p.light, true)));
      return wrap;
    }
    if (key==="avhard"){
      if (p.avhard==="–") return el("span", { style:{ color:C("inkFaint"),
        fontSize:"10px", fontStyle:"italic", fontFamily:"monospace" } }, "n/a");
      const wrap = el("div");
      wrap.appendChild(el("div", { class:"ell", style:{ fontSize:"10px", fontWeight:"700",
        color:C("sunPart") } }, p.avhard));
      wrap.appendChild(el("div", { style:{ fontSize:"9px", color:C("inkMid") } }, "börja ute"));
      return wrap;
    }
    if (key==="date"){ // Utplantering – bara förkultiverade
      return p.type==="pre"
        ? el("div", { class:"ell", style:{ fontSize:"10px", fontWeight:"700", color:C("green") } }, p.date)
        : el("span", { style:{ color:C("inkFaint"), fontSize:"10px",
            fontStyle:"italic", fontFamily:"monospace" } }, "n/a");
    }
    if (key==="sow"){ // Direktsådd – bara direktsådda
      return p.type==="direct"
        ? el("div", { class:"ell", style:{ fontSize:"10px", fontWeight:"700", color:C("accent") } }, p.date)
        : el("span", { style:{ color:C("inkFaint"), fontSize:"10px",
            fontStyle:"italic", fontFamily:"monospace" } }, "n/a");
    }
  }

  pane.appendChild(buildTable(cols, PLANTS, { sortKey:"date", sortValue:sortValue, render:render }));
  return pane;
}

/* ---- FLIK: SÅSCHEMA --------------------------------------- */

function renderSchemaTab(){
  const pane = el("div", { class:"tab-pane" });
  const MONTHS  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const FULL_M  = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  const CLR = { indoor:"#3868b8", outdoor:"#a07010", harvest:"#287820" };

  // De tre aktiviteterna en växt kan ha. En växt får bara de delrader
  // där den faktiskt har månader ifyllda – inga tomma rader.
  const ACTS = [
    { key:"indoor",  color:CLR.indoor,  short:"Förkult.", full:"Förkultiveras" },
    { key:"outdoor", color:CLR.outdoor, short:"Direkt",   full:"Direktsås" },
    { key:"harvest", color:CLR.harvest, short:"Skörd",    full:"Skörd / blomtid" },
  ];

  const legend = el("div", { class:"legend-row" });
  [["indoor",CLR.indoor,"Förkultiveras"],["outdoor",CLR.outdoor,"Direktsås ute"],
   ["harvest",CLR.harvest,"Skörd / blomtid"]].forEach(function(p){
    legend.appendChild(el("div", { class:"legend-item" }, [
      el("div", { class:"legend-sq", style:{ background:p[1] } }), p[2]
    ]));
  });
  pane.appendChild(legend);

  const wrap = el("div", { class:"tbl-wrap" });
  const inner = el("div", { style:{ minWidth:"480px" } });
  const gridCols = "minmax(150px,1.4fr) repeat(12,1fr)";

  // Månadsrubriker
  const mhead = el("div", { style:{ display:"grid", gridTemplateColumns:gridCols,
    gap:"2px", marginBottom:"6px", paddingLeft:"4px" } });
  mhead.appendChild(el("div"));
  MONTHS.forEach(function(m){
    mhead.appendChild(el("div", { style:{ textAlign:"center", fontSize:"9px",
      color:C("inkMid"), fontFamily:"monospace" } }, m));
  });
  inner.appendChild(mhead);

  // En delrad: liten etikett + 12 månadsrutor för EN aktivitet
  function actRow(months, act, isFirst, plant){
    const r = el("div", { style:{ display:"grid", gridTemplateColumns:gridCols,
      gap:"2px", marginBottom:"2px" } });
    // Vänster cell: visa växtnamn bara på växtens första delrad,
    // annars en liten aktivitetsetikett indragen.
    const left = el("div", { style:{ display:"flex", alignItems:"center",
      gap:"5px", padding:"0 4px", overflow:"hidden" } });
    if (isFirst){
      left.appendChild(el("span", { style:{ fontSize:"11px", flexShrink:"0" } }, plant.emoji));
      left.appendChild(el("span", { class:"ell", style:{ fontSize:"9px", color:C("ink"),
        fontStyle:"italic", fontFamily:"Georgia,serif" } }, plant.name));
    } else {
      left.appendChild(el("span", { style:{ width:"14px", flexShrink:"0" } }));
    }
    left.appendChild(el("span", { style:{ fontSize:"7px", color:act.color,
      fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.04em",
      marginLeft:"auto", flexShrink:"0" } }, act.short));
    r.appendChild(left);
    for (let mi=1; mi<=12; mi++){
      const on = months.indexOf(mi) >= 0;
      r.appendChild(el("div", { title: FULL_M[mi-1] + (on ? " · " + act.full : ""),
        style:{ height:"16px", borderRadius:"3px",
          background: on ? act.color : "transparent",
          opacity: on ? "0.82" : "1",
          border:"1px solid " + (on ? act.color : C("border")) } }));
    }
    return r;
  }

  // Ett block per växt: namn + 1–3 delrader (bara de som har data).
  // Bryts ut till funktion så sökrutan kan rita om listan.
  function renderBlocks(query){
    // Töm alla block (allt utom månadsrubriken som ligger först)
    while (inner.children.length > 1) inner.removeChild(inner.lastChild);
    const q = (query || "").trim().toLowerCase();
    const list = SCHEMA_DATA.filter(function(p){
      return !q || p.name.toLowerCase().indexOf(q) >= 0;
    });
    if (list.length === 0){
      inner.appendChild(el("div", { style:{ padding:"18px", textAlign:"center",
        color:C("inkMid"), fontSize:"12px", fontStyle:"italic" } },
        "Inga växter matchar \u201c" + query + "\u201d"));
      return;
    }
    list.forEach(function(p, idx){
      const active = ACTS.filter(function(a){ return p[a.key] && p[a.key].length > 0; });
      const block = el("div", { style:{ marginBottom:"7px", paddingBottom:"5px",
        borderBottom: idx < list.length-1 ? "1px solid "+C("border") : "none" } });
      active.forEach(function(a, i){
        block.appendChild(actRow(p[a.key], a, i===0, p));
      });
      inner.appendChild(block);
    });
  }

  wrap.appendChild(inner);

  // Sökruta ovanför schemat (samma stil som övriga tabeller)
  const searchBox = el("div", { class:"tbl-search" });
  const input = el("input", { type:"text", class:"tbl-search-input",
    placeholder:"S\u00f6k v\u00e4xt i s\u00e5schemat\u2026" });
  const clearBtn = el("button", { class:"tbl-search-clear",
    "aria-label":"Rensa s\u00f6kning", style:{ visibility:"hidden" } }, "\u2715");
  input.addEventListener("input", function(){
    clearBtn.style.visibility = input.value.trim() ? "visible" : "hidden";
    renderBlocks(input.value);
  });
  clearBtn.addEventListener("click", function(){
    input.value = ""; clearBtn.style.visibility = "hidden";
    renderBlocks(""); input.focus();
  });
  searchBox.appendChild(el("span", { class:"tbl-search-icon" }, "\uD83D\uDD0D"));
  searchBox.appendChild(input);
  searchBox.appendChild(clearBtn);

  renderBlocks("");
  pane.appendChild(searchBox);
  pane.appendChild(wrap);

  const note = el("div", { class:"card", style:{ marginTop:"14px", borderStyle:"dashed" } });
  note.appendChild(el("div", { style:{ fontSize:"11px", color:C("inkMid"),
    lineHeight:"1.8", fontStyle:"italic" } },
    "Varje växt visar en rad per moment den kan göra (förkultivering, direktsådd, skörd/blomtid). En del kan både förodlas och direktsås. · Sista frost Stockholm ca 15 maj"));
  pane.appendChild(note);
  return pane;
}

/* ---- FLIK: GÖDSLING --------------------------------------- */

function renderGodslingTab(){
  const pane = el("div", { class:"tab-pane" });
  const methods = [
    { key:"bokashi", label:"Bokashi-te",   color:"#7a4e20" },
    { key:"nassle",  label:"Nässelvatten", color:"#245e14" },
    { key:"hons",    label:"Hönsgödsel",   color:"#7a5e08" },
  ];

  const start = el("div", { class:"card", style:{ marginBottom:"14px",
    borderLeft:"3px solid "+C("green") } });
  start.appendChild(el("div", { style:{ fontSize:"12px", fontWeight:"700",
    color:C("green"), marginBottom:"5px", fontFamily:"Georgia,serif" } },
    "🌱 Säsongsstart – en gång per år"));
  const startTxt = el("div", { style:{ fontSize:"12px", color:C("inkMid"), lineHeight:"1.7" } });
  startTxt.innerHTML = 'Fyll odlingslådor och krukor med bokashikompost blandat med köpt jord. Blanda <strong style="color:'+C("ink")+'">1 del bokashi på 4–5 delar jord</strong>. Vänta 2–3 veckor om komposten är färsk.';
  start.appendChild(startTxt);
  pane.appendChild(start);

  const legend = el("div", { class:"legend-row" });
  methods.forEach(function(m){
    legend.appendChild(el("div", { class:"legend-item" }, m.label));
  });
  legend.appendChild(el("span", { class:"hint" }, "● ● ● bäst · ● ○ ○ funkar · Dra kolumnkant för bredd"));
  pane.appendChild(legend);

  const cols = [
    { key:"name",   label:"Växt",   w:180 },
    { key:"period", label:"Period", w:72, align:"center" },
    { key:"bokashi",label:"🫙",     w:52, align:"center" },
    { key:"nassle", label:"🌱",     w:52, align:"center" },
    { key:"hons",   label:"🐔",     w:52, align:"center" },
  ];

  function render(p, key){
    if (key==="name"){
      const box = el("div");
      const top = el("div", { style:{ display:"flex", gap:"6px", alignItems:"center" } });
      top.appendChild(el("span", { style:{ fontSize:"14px", flexShrink:"0" } }, p.emoji));
      top.appendChild(el("span", { class:"ell", style:{ fontSize:"11px", fontWeight:"600",
        color:C("ink"), fontFamily:"Georgia,serif", fontStyle:"italic" } }, p.name));
      box.appendChild(top);
      box.appendChild(el("div", { class:"ell", style:{ fontSize:"9px", color:C("inkMid"),
        marginTop:"2px", paddingLeft:"20px" } }, p.note));
      return box;
    }
    if (key==="period"){
      const box = el("div");
      box.appendChild(el("div", { class:"ell", style:{ fontSize:"9px", fontWeight:"700",
        color:C("green") } }, p.period));
      box.appendChild(el("div", { class:"ell", style:{ fontSize:"8px", color:C("inkMid") } }, p.interval));
      return box;
    }
    const m = methods.filter(function(x){ return x.key===key; })[0];
    return el("div", { style:{ display:"flex", justifyContent:"center" } }, makeDots(p[key], m.color));
  }

  pane.appendChild(buildTable(cols, GODSLING_DATA, { render:render }));

  const tips = el("div", { style:{ display:"flex", flexDirection:"column",
    gap:"8px", marginTop:"14px" } });
  [["🫙","Bokashi-te","#7a4e20","Späd 1:100 (ca 1 msk per liter). Vattna direkt i jorden – undvik bladen."],
   ["🌱","Nässelvatten","#245e14","Späd 1:10. Rikt på kväve – perfekt för bladgrönsaker och tomater under tillväxt."],
   ["🐔","Hönsgödsel","#7a5e08","Strö runt plantan, vattna in ordentligt. Långsam näring – bra som grundgödsling i maj."]
  ].forEach(function(b){
    const c = el("div", { class:"card", style:{ borderLeft:"3px solid "+b[2] } });
    c.appendChild(el("div", { style:{ fontSize:"11px", fontWeight:"700", color:b[2],
      marginBottom:"4px" } }, b[0]+" "+b[1]));
    c.appendChild(el("div", { style:{ fontSize:"11px", color:C("inkMid"), lineHeight:"1.6" } }, b[3]));
    tips.appendChild(c);
  });
  pane.appendChild(tips);
  return pane;
}

/* ---- FLIK: DAGBOK ----------------------------------------- */

function renderDiaryTab(){
  const pane = el("div", { class:"tab-pane" });

  /* ─────────────────────────────────────────────────────────────
     DÖLJ / VISA ÅRSKNAPPAR
     ─────────────────────────────────────────────────────────────
     Året 2027 finns redan förberett i DIARY (i index.html) men
     dess knapp är dold tills du vill börja använda den.

     SÅ HÄR TÄNDER DU 2027-KNAPPEN när du är redo:
       Ta bort "2027" ur listan nedan så att raden blir:
         const HIDDEN_YEARS = [];
       (Eller töm hela listan – allt som står kvar i listan göms.)

     SÅ HÄR DÖLJER DU ETT ÅR IGEN:
       Lägg tillbaka årtalet som text i listan, t.ex. ["2027"].
     ───────────────────────────────────────────────────────────── */
  const HIDDEN_YEARS = ["2027"];

  // Bara år som INTE står i HIDDEN_YEARS får en knapp.
  // (Datan för dolda år ligger kvar i DIARY – inget tas bort.)
  const years = Object.keys(DIARY)
    .filter(function(y){ return HIDDEN_YEARS.indexOf(String(y)) < 0; })
    .sort(function(a,b){ return b-a; });
  let year = years[0] || "2026";

  const controls = el("div", { style:{ display:"flex", gap:"8px", marginBottom:"14px",
    alignItems:"center", flexWrap:"wrap" } });
  controls.appendChild(el("span", { style:{ fontSize:"12px", color:C("inkMid"),
    fontStyle:"italic" } }, "Säsong:"));
  const tableHolder = el("div");

  function yearBtn(y){
    const on = year === y;
    const b = el("button", { style:{ padding:"5px 16px", borderRadius:"20px",
      border:"1px solid " + (on?C("accent"):C("border")),
      background: on ? C("accent")+"22" : "transparent",
      color: on ? C("accent") : C("inkMid"), cursor:"pointer", fontSize:"12px",
      fontFamily:"Georgia,serif", fontStyle:"italic", fontWeight: on?"700":"400" } }, y);
    b.addEventListener("click", function(){ year = y; redraw(); });
    return b;
  }

  const legend2 = el("div", { class:"legend-row" });
  [["#2858a8","Förkultiverad"],["#8a6010","Direktsådd"],[C("green"),"Utplanterad"],
   ["#7a3010","Skörd"]].forEach(function(p){
    legend2.appendChild(el("div", { class:"legend-item" }, [
      el("div", { style:{ width:"10px", height:"10px", borderRadius:"2px", background:p[0] } }), p[1]
    ]));
  });
  legend2.appendChild(el("span", { class:"hint" }, "Dra kolumnkant för att ändra bredd"));

  function cellColor(key, val){
    if (!val || val==="–") return C("inkFaint");
    if (key==="forcedDate")  return "#2858a8";
    if (key==="sownDate")    return "#8a6010";
    if (key==="plantedDate") return C("green");
    if (key==="harvest")     return "#7a3010";
    return C("inkMid");
  }

  const cols = [
    { key:"plant",         label:"Växt",         w:130 },
    { key:"variety",       label:"Sort",         w:130 },
    { key:"forcedDate",    label:"Förkultiverad",w:100 },
    { key:"plantedDate",   label:"Utplanterad",  w:88  },
    { key:"sownDate",      label:"Direktsådd",   w:88  },
    { key:"fertilizeFreq", label:"Gödsel",       w:90  },
    { key:"harvest",       label:"Skörd",        w:90  },
    { key:"note",          label:"Anteckningar", w:260 },
  ];

  function render(rowData, key){
    const val = rowData[key];
    const isName = key==="plant" || key==="variety";
    if (key==="note"){
      if (!val) return el("span", { style:{ color:C("inkFaint"), fontSize:"11px" } }, "–");
      // Visas på en rad (fast höjd). Tooltip på hover (dator),
      // klick öppnar en modal med hela texten (bra på iPad/mobil).
      const cell = el("div", { class:"ell note-cell",
        title: val,
        style:{ fontSize:"11px", color:C("inkMid"), fontFamily:"monospace", cursor:"pointer" }
      }, val);
      cell.addEventListener("click", function(){ openNoteModal(rowData); });
      return cell;
    }
    // En växt följer en av tre vägar: förkultiverad, direktsådd
    // eller bara utplanterad. Kolumner som inte hör till växtens
    // väg markeras "n/a" (ej tillämpligt).
    const isForced  = !!rowData.forcedDate;
    const isSown    = !!rowData.sownDate;
    const isPlanted = !!rowData.plantedDate;
    function naCell(){
      return el("div", { style:{ fontSize:"10px", color:C("inkFaint"),
        fontStyle:"italic", fontFamily:"monospace" } }, "n/a");
    }
    if (key==="forcedDate" && !isForced && (isSown || isPlanted)) return naCell();
    if (key==="sownDate"   && !isSown   && (isForced || isPlanted)) return naCell();
    if (key==="plantedDate"&& !isPlanted && isSown) return naCell();
    return el("div", { class:"ell", style:{ fontSize:"11px",
      color: cellColor(key, val),
      fontStyle: isName?"italic":"normal",
      fontFamily: isName?"Georgia,serif":"monospace",
      fontWeight: key==="plant"?"600":"400" } }, val || "–");
  }

  // Liten ruta (modal) som visar hela anteckningen
  function openNoteModal(rowData){
    const overlay = el("div", { class:"note-modal-overlay" });
    const box = el("div", { class:"note-modal" });
    const head = el("div", { class:"note-modal-head" });
    head.appendChild(el("div", { class:"note-modal-title" },
      rowData.plant + (rowData.variety && rowData.variety!=="–" ? " · " + rowData.variety : "")));
    const closeBtn = el("button", { class:"note-modal-close", "aria-label":"Stäng" }, "✕");
    head.appendChild(closeBtn);
    box.appendChild(head);
    box.appendChild(el("div", { class:"note-modal-body" }, rowData.note));
    overlay.appendChild(box);
    function close(){ overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e){ if (e.key === "Escape") close(); }
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function(e){ if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  function redraw(){
    controls.querySelectorAll("button").forEach(function(b){ b.remove(); });
    years.forEach(function(y){ controls.appendChild(yearBtn(y)); });
    tableHolder.innerHTML = "";
    const rows = DIARY[year] || [];
    if (rows.length === 0){
      tableHolder.appendChild(el("div", { style:{ textAlign:"center", padding:"40px",
        color:C("inkMid"), fontStyle:"italic", fontSize:"13px" } },
        "Inga anteckningar för "+year+" ännu."));
    } else {
      tableHolder.appendChild(buildTable(cols, rows, { render:render }));
    }
  }

  pane.appendChild(controls);
  pane.appendChild(legend2);
  pane.appendChild(tableHolder);
  redraw();

  const note = el("div", { class:"card", style:{ marginTop:"14px", borderStyle:"dashed" } });
  const noteTxt = el("div", { style:{ fontSize:"11px", color:C("inkMid"),
    lineHeight:"1.8", fontStyle:"italic" } });
  noteTxt.innerHTML = '📝 Lägg till nya år och rader i <code style="font-style:normal;background:'+C("bgAlt")+';padding:1px 5px;border-radius:3px;font-size:10px;color:'+C("ink")+'">DIARY</code> i index.html.';
  note.appendChild(noteTxt);
  pane.appendChild(note);
  return pane;
}

/* ---- SIDANS SKAL: rubrik, flikar, tema -------------------- */

const TABS = [
  { id:"karta",    icon:"🗺",  label:"Karta",    render:renderMapTab },
  { id:"plantor",  icon:"🌱",  label:"Plantor",  render:renderPlantsTab },
  { id:"schema",   icon:"📅",  label:"Såschema", render:renderSchemaTab },
  { id:"godsling", icon:"🌿",  label:"Gödsling", render:renderGodslingTab },
  { id:"dagbok",   icon:"📓",  label:"Dagbok",   render:renderDiaryTab },
];

let currentTab = "karta";
let dark = false;

function buildApp(){
  const app = document.getElementById("app");
  app.innerHTML = "";

  // Sidhuvud
  const header = el("div", { class:"header" });
  const htop = el("div", { class:"header-top" });
  const hleft = el("div");
  hleft.appendChild(el("div", { class:"header-eyebrow" }, SITE.eyebrow));
  hleft.appendChild(el("div", { class:"header-title" }, SITE.title));
  hleft.appendChild(el("div", { class:"header-sub" }, SITE.sub));
  const themeBtn = el("button", { class:"theme-btn" }, dark ? "☀️ Ljust" : "🌙 Mörkt");
  themeBtn.addEventListener("click", function(){
    dark = !dark;
    document.body.classList.toggle("dark", dark);
    buildApp(); // rita om så färgerna uppdateras
  });
  htop.appendChild(hleft);
  htop.appendChild(themeBtn);
  header.appendChild(htop);
  app.appendChild(header);

  // Flikrad
  const tabs = el("div", { class:"tabs" });
  TABS.forEach(function(tb){
    const b = el("button", { class:"tab-btn"+(currentTab===tb.id?" active":"") });
    b.appendChild(el("span", { class:"icon" }, tb.icon));
    b.appendChild(el("span", { class:"lbl" }, tb.label));
    b.addEventListener("click", function(){
      currentTab = tb.id;
      buildApp();
    });
    tabs.appendChild(b);
  });
  app.appendChild(tabs);

  // Aktivt flikinnehåll
  const active = TABS.filter(function(t){ return t.id===currentTab; })[0];
  app.appendChild(active.render());
}

// Starta sidan när den laddats
document.addEventListener("DOMContentLoaded", buildApp);
