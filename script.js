const introScreen = document.getElementById("intro-screen");
const siteShell = document.getElementById("site-shell");
const navToggle = document.getElementById("nav-toggle");
const mainNav = document.getElementById("main-nav");
const accessibilityToggle = document.getElementById("accessibility-toggle");
const accessibilityPanel = document.getElementById("accessibility-panel");
const closePanelButton = document.getElementById("close-panel");
const cookieBanner = document.getElementById("cookie-banner");
const cookieAcceptButton = document.getElementById("cookie-accept");
const cookieRejectButton = document.getElementById("cookie-reject");
const projectsMapElement = document.getElementById("projects-map");
const projectsMapShell = projectsMapElement ? projectsMapElement.closest(".projects-map-shell") : null;
const revealTargets = document.querySelectorAll("[data-reveal]");
const heroElement = document.getElementById("hero");
const accessibilityStorageKey = "asiseng-accessibility-settings";
const cookieConsentStorageKey = "asiseng-cookie-consent-v2";
// Keep controls working even when the browser blocks persistent site storage.
const sessionSettings = new Map();
const settingsStorage = {
  getItem(key) {
    if (sessionSettings.has(key)) return sessionSettings.get(key);
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    sessionSettings.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The choice remains effective for the current page.
    }
  },
  removeItem(key) {
    sessionSettings.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // No persistent storage is available to clear.
    }
  },
};
const mapboxToken =
  "pk.eyJ1IjoiaWRhbmg1IiwiYSI6ImNtcDAybXY4aDExZ3YycHNmeGN3cTkxeW8ifQ.vqvma0E55jOZdxpoQHoNBQ";

const media = {
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)"),
  desktop: window.matchMedia("(min-width: 960px)"),
};

const state = {
  fontScale: 100,
  highContrast: false,
  readableFont: false,
  underlineLinks: false,
  stopMotion: false,
};

const bodyClassMap = {
  highContrast: "accessibility-high-contrast",
  readableFont: "accessibility-readable-font",
  underlineLinks: "accessibility-underline-links",
  stopMotion: "accessibility-stop-motion",
};

let revealObserver;
let mapInstance;
let mapAssetsPromise;
let heroObserver;
const accessibilityToggleHome = document.createComment("accessibility toggle desktop position");
accessibilityToggle?.before(accessibilityToggleHome);

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function shouldReduceMotion() {
  return state.stopMotion || (media.reducedMotion.matches && !hasCookieConsent());
}

function hasCookieConsent() {
  return settingsStorage.getItem(cookieConsentStorageKey) === "accepted";
}

function applyAccessibilityState() {
  document.documentElement.style.setProperty("--font-size-base", `${state.fontScale}%`);
  document.body.classList.toggle(bodyClassMap.highContrast, state.highContrast);
  document.body.classList.toggle(bodyClassMap.readableFont, state.readableFont);
  document.body.classList.toggle(bodyClassMap.underlineLinks, state.underlineLinks);
  document.body.classList.toggle(bodyClassMap.stopMotion, state.stopMotion);
  syncMotionPreference();
  settingsStorage.setItem(accessibilityStorageKey, JSON.stringify(state));
}

function syncMotionPreference() {
  document.documentElement.classList.toggle("motion-enabled", !shouldReduceMotion());
}

function loadAccessibilityState() {
  const savedState = settingsStorage.getItem(accessibilityStorageKey);
  if (!savedState) return;

  try {
    Object.assign(state, JSON.parse(savedState));
  } catch {
    settingsStorage.removeItem(accessibilityStorageKey);
  }
}

function setPanelState(isOpen) {
  if (!accessibilityPanel || !accessibilityToggle) return;
  accessibilityPanel.hidden = !isOpen;
  accessibilityToggle.setAttribute("aria-expanded", String(isOpen));
}

function positionAccessibilityToggle() {
  if (!accessibilityToggle) return;
  if (media.desktop.matches) {
    accessibilityToggleHome.after(accessibilityToggle);
  } else if (navToggle) {
    navToggle.before(accessibilityToggle);
  } else {
    document.querySelector(".site-header__inner")?.append(accessibilityToggle);
  }
}

function setNavState(isOpen) {
  if (!mainNav || !navToggle) return;

  const nextState = Boolean(isOpen && !media.desktop.matches);
  mainNav.classList.toggle("is-open", nextState);
  navToggle.setAttribute("aria-expanded", String(nextState));
  navToggle.setAttribute("aria-label", nextState ? "סגירת תפריט" : "פתיחת תפריט");
  document.body.classList.toggle("nav-open", nextState);
}

function setCookieBannerState(isVisible) {
  if (!cookieBanner) return;

  cookieBanner.hidden = !isVisible;
  document.body.classList.toggle("cookie-banner-open", isVisible);
}

function loadMapAssets() {
  if (window.mapboxgl) return Promise.resolve();
  if (mapAssetsPromise) return mapAssetsPromise;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css";
  document.head.append(stylesheet);

  mapAssetsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.js";
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      stylesheet.remove();
      mapAssetsPromise = undefined;
      reject(new Error("Map assets unavailable"));
    };
    document.head.append(script);
  });
  return mapAssetsPromise;
}

// The visible HTML list is also the source of truth for map content.
const projectCards = [...document.querySelectorAll(".project-card")];
const projectMarkers = new Map();
let selectedProject;

let galleryIndex = 0;
let markerLayoutFrame;
const gallery = document.querySelector(".projects__list");
const connections = document.querySelector(".projects-map__connections");

function fitProjectBounds(duration = shouldReduceMotion() ? 0 : 800) {
  if (!mapInstance || !projectCards.length) return;
  const bounds = new window.mapboxgl.LngLatBounds();
  projectCards.forEach((card) => bounds.extend([Number(card.dataset.lng), Number(card.dataset.lat)]));
  mapInstance.fitBounds(bounds, { padding: { top: 75, bottom: 65, left: 65, right: 65 }, maxZoom: 10, duration });
}

// Separate nearby labels on screen while retaining a line to their true location.
// Recompute after camera/viewport changes, without changing geographic coordinates.
function layoutProjectMarkers() {
  if (!mapInstance || !connections) return;
  const width = projectsMapElement.clientWidth;
  const height = projectsMapElement.clientHeight;
  const occupied = [];
  const lines = document.createDocumentFragment();
  const svgNS = "http://www.w3.org/2000/svg";
  projectMarkers.forEach((marker) => {
    const point = mapInstance.project(marker.getLngLat());
    const element = marker.getElement();
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
      marker.setOffset([0, 0]);
      return;
    }
    const halfWidth = element.offsetWidth / 2 + 5;
    const halfHeight = element.offsetHeight / 2 + 5;
    let placement;
    // Search outwards from the exact point, choosing the closest free space.
    for (let ring = 0; ring < 22 && !placement; ring++) {
      const steps = ring ? ring * 8 : 1;
      for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const x = point.x + Math.cos(angle) * ring * 14;
        const y = point.y + Math.sin(angle) * ring * 14;
        const rect = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
        if (rect.left < 8 || rect.right > width - 8 || rect.top < 10 || rect.bottom > height - 25) continue;
        if (rect.left < 50 && rect.top < 110) continue;
        if (occupied.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top)) continue;
        placement = { x, y, rect };
        break;
      }
    }
    if (!placement) { marker.setOffset([0, 0]); return; }
    occupied.push(placement.rect);
    marker.setOffset([placement.x - point.x, placement.y - point.y]);
    if (Math.hypot(placement.x - point.x, placement.y - point.y) > 5) {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", point.x); line.setAttribute("y1", point.y);
      line.setAttribute("x2", placement.x); line.setAttribute("y2", placement.y);
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", point.x); dot.setAttribute("cy", point.y); dot.setAttribute("r", "3");
      lines.append(line, dot);
    }
  });
  connections.replaceChildren(lines);
}

function scheduleMarkerLayout() {
  if (markerLayoutFrame) return;
  markerLayoutFrame = window.requestAnimationFrame(() => {
    markerLayoutFrame = undefined;
    layoutProjectMarkers();
  });
}

function syncGalleryControls(index) {
  galleryIndex = index;
  const position = document.getElementById("projects-position");
  const visibleCount = gallery && projectCards[0]
    ? Math.max(1, Math.round((gallery.clientWidth + 16) / (projectCards[0].getBoundingClientRect().width + 16))) : 1;
  const end = Math.min(projectCards.length, index + visibleCount);
  if (position) position.textContent = visibleCount > 1
    ? `${String(index + 1).padStart(2, "0")}–${String(end).padStart(2, "0")} / ${projectCards.length}`
    : `${String(index + 1).padStart(2, "0")} / ${projectCards.length}`;
  const previous = document.getElementById("projects-prev");
  const next = document.getElementById("projects-next");
  if (previous) previous.disabled = index === 0;
  if (next) next.disabled = index >= projectCards.length - visibleCount;
}

function revealGalleryCard(card) {
  if (!gallery || !card) return;
  const distance = card.getBoundingClientRect().right - gallery.getBoundingClientRect().right;
  gallery.scrollTo({ left: gallery.scrollLeft + distance, behavior: shouldReduceMotion() ? "instant" : "smooth" });
}

function selectProject(card, moveMap = true, revealCard = false) {
  selectedProject = card;
  projectCards.forEach((item) => {
    const selected = item === card;
    item.classList.toggle("is-selected", selected);
    item.querySelector("button").setAttribute("aria-pressed", String(selected));
    const marker = projectMarkers.get(item);
    marker?.getElement().setAttribute("aria-pressed", String(selected));
    marker?.getElement().setAttribute("aria-expanded", "false");
    if (marker?.getPopup().isOpen()) marker.getPopup().remove();
  });
  if (!card) return;
  syncGalleryControls(projectCards.indexOf(card));
  if (revealCard) revealGalleryCard(card);
  const marker = projectMarkers.get(card);
  if (!marker) return;
  marker.togglePopup();
  marker.getElement().setAttribute("aria-expanded", "true");
  if (moveMap) mapInstance.flyTo({ center: marker.getLngLat(), zoom: 10.5, duration: shouldReduceMotion() ? 0 : 1100 });
}

projectCards.forEach((card) => {
  card.querySelector("button").addEventListener("click", () => selectProject(card));
});
["prev", "next"].forEach((direction) => {
  document.getElementById(`projects-${direction}`)?.addEventListener("click", () => {
    const index = Math.max(0, Math.min(projectCards.length - 1, galleryIndex + (direction === "next" ? 1 : -1)));
    revealGalleryCard(projectCards[index]);
    syncGalleryControls(index);
  });
});
let galleryScrollFrame;
gallery?.addEventListener("scroll", () => {
  if (galleryScrollFrame) return;
  galleryScrollFrame = window.requestAnimationFrame(() => {
    galleryScrollFrame = undefined;
    const edge = gallery.getBoundingClientRect().right;
    let nearest = 0;
    projectCards.forEach((card, index) => {
      if (Math.abs(card.getBoundingClientRect().right - edge) < Math.abs(projectCards[nearest].getBoundingClientRect().right - edge)) nearest = index;
    });
    syncGalleryControls(nearest);
  });
}, { passive: true });
syncGalleryControls(0);
document.getElementById("projects-map-reset")?.addEventListener("click", () => {
  selectProject(undefined, false);
  fitProjectBounds();
});

async function initMapbox() {
  if (!projectsMapElement || mapInstance || !hasCookieConsent()) return;
  try {
    await loadMapAssets();
    if (!hasCookieConsent() || mapInstance || !window.mapboxgl) return;

    window.mapboxgl.accessToken = mapboxToken;

    mapInstance = new window.mapboxgl.Map({
      container: projectsMapElement,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [34.95, 32.1],
      zoom: 6.5,
      attributionControl: false,
      cooperativeGestures: !media.desktop.matches,
    });

    mapInstance.addControl(
      new window.mapboxgl.NavigationControl({
        showCompass: false,
      }),
      "top-left",
    );

    mapInstance.addControl(new window.mapboxgl.AttributionControl({ compact: true }));

    projectCards.forEach((card, index) => {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "project-map-marker";
      const number = document.createElement("span");
      number.className = "project-map-marker__number";
      number.textContent = String(index + 1).padStart(2, "0");
      const city = document.createElement("span");
      city.className = "project-map-marker__city";
      city.textContent = card.querySelector(".project-card__city").textContent;
      pin.append(number, city);
      pin.setAttribute("aria-label", card.querySelector("button").getAttribute("aria-label"));
      pin.setAttribute("aria-pressed", "false");
      const content = document.createElement("div");
      content.className = "project-popup";
      [".project-card__city", ".project-card__title", ".project-card__description"].forEach((selector) => {
        content.append(card.querySelector(selector).cloneNode(true));
      });
      const popup = new window.mapboxgl.Popup({ offset: 24, maxWidth: "300px", focusAfterOpen: false })
        .setDOMContent(content);
      const marker = new window.mapboxgl.Marker({ element: pin, anchor: "center" })
        .setLngLat([Number(card.dataset.lng), Number(card.dataset.lat)])
        .setPopup(popup);
      projectMarkers.set(card, marker);
      marker.addTo(mapInstance);
      // Stop Mapbox's automatic toggle; selection handles all popups together.
      pin.addEventListener("click", (event) => {
        event.stopPropagation();
        selectProject(card, true, true);
      });
    });
    fitProjectBounds();
    mapInstance.on("move", scheduleMarkerLayout);
    mapInstance.on("resize", scheduleMarkerLayout);

    mapInstance.on("load", () => {
      projectsMapShell?.classList.add("is-active");
      mapInstance.resize();
      fitProjectBounds();
      scheduleMarkerLayout();
      if (selectedProject) selectProject(selectedProject);
    });
  } catch {
    const placeholder = document.getElementById("projects-map-placeholder");
    if (placeholder && hasCookieConsent()) {
      placeholder.textContent = "המפה אינה זמינה כרגע. כל פרטי הפרויקטים זמינים ברשימה למטה.";
    }
  }
}

function acceptCookies() {
  settingsStorage.setItem(cookieConsentStorageKey, "accepted");
  setCookieBannerState(false);
  syncMotionPreference();
  initRevealObserver();
  initMapbox();
}

function rejectOptionalCookies() {
  settingsStorage.setItem(cookieConsentStorageKey, "essential");
  setCookieBannerState(false);
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = undefined;
    projectMarkers.clear();
    connections?.replaceChildren();
  }
  projectsMapShell?.classList.remove("is-active");
  const placeholder = document.getElementById("projects-map-placeholder");
  if (placeholder) placeholder.textContent = "אשרו שירותים חיצוניים בהגדרות הפרטיות כדי לטעון את המפה. פרטי הפרויקטים זמינים ברשימה למטה.";
  syncMotionPreference();
  initRevealObserver();
}

function handleAccessibilityAction(action) {
  switch (action) {
    case "increase-text":
      state.fontScale = Math.min(state.fontScale + 10, 150);
      break;
    case "decrease-text":
      state.fontScale = Math.max(state.fontScale - 10, 90);
      break;
    case "toggle-contrast":
      state.highContrast = !state.highContrast;
      break;
    case "toggle-readable-font":
      state.readableFont = !state.readableFont;
      break;
    case "toggle-underline-links":
      state.underlineLinks = !state.underlineLinks;
      break;
    case "toggle-stop-motion":
      state.stopMotion = !state.stopMotion;
      break;
    case "reset-accessibility":
      state.fontScale = 100;
      state.highContrast = false;
      state.readableFont = false;
      state.underlineLinks = false;
      state.stopMotion = false;
      break;
    default:
      return;
  }

  applyAccessibilityState();
  initRevealObserver();
}

function initIntro() {
  if (!introScreen || !siteShell) {
    initRevealObserver();
    return;
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection && connection.saveData);
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const introDelay = shouldReduceMotion() || saveData ? 0 : coarsePointer ? 380 : 720;

  window.setTimeout(() => {
    introScreen.classList.add("is-hidden");
    siteShell.classList.add("is-ready");
    // Let the page appear before starting its entrance effects.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(initRevealObserver);
    });
  }, introDelay);
}

function resetInitialScroll() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
}

function initRevealObserver() {
  if (!revealTargets.length) return;

  if (revealObserver) {
    revealObserver.disconnect();
  }

  if (shouldReduceMotion() || !("IntersectionObserver" in window)) {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  revealTargets.forEach((element) => element.classList.remove("is-visible"));

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: media.desktop.matches ? 0.12 : 0.01,
      rootMargin: media.desktop.matches ? "0px 0px -8% 0px" : "0px 0px -32px 0px",
    },
  );

  revealTargets.forEach((element) => revealObserver.observe(element));
}

function initHeroObserver() {
  heroObserver?.disconnect();
  if (!heroElement || media.desktop.matches || !("IntersectionObserver" in window)) return;
  heroObserver = new IntersectionObserver(([entry]) => {
    heroElement.classList.toggle("is-in-view", entry.isIntersecting);
  });
  heroObserver.observe(heroElement);
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-cookie-settings]")) {
    setPanelState(false);
    setCookieBannerState(true);
    cookieAcceptButton?.focus({ preventScroll: true });
  }
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    handleAccessibilityAction(actionTarget.dataset.action);
  }

  if (
    accessibilityPanel &&
    !accessibilityPanel.hidden &&
    !accessibilityPanel.contains(event.target) &&
    event.target !== accessibilityToggle
  ) {
    setPanelState(false);
  }

  if (
    mainNav &&
    navToggle &&
    mainNav.classList.contains("is-open") &&
    !mainNav.contains(event.target) &&
    event.target !== navToggle &&
    !navToggle.contains(event.target)
  ) {
    setNavState(false);
  }
});

if (navToggle) {
  navToggle.addEventListener("click", () => {
    setNavState(!mainNav.classList.contains("is-open"));
  });
}

if (mainNav) {
  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setNavState(false);
    }
  });
}

if (accessibilityToggle) {
  accessibilityToggle.addEventListener("click", () => {
    setPanelState(accessibilityPanel ? accessibilityPanel.hidden : false);
  });
}

if (closePanelButton) {
  closePanelButton.addEventListener("click", () => setPanelState(false));
}

if (cookieAcceptButton) {
  cookieAcceptButton.addEventListener("click", acceptCookies);
}

cookieRejectButton?.addEventListener("click", rejectOptionalCookies);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setPanelState(false);
    setNavState(false);
  }
});

media.desktop.addEventListener("change", () => {
  setNavState(false);
  positionAccessibilityToggle();
  initRevealObserver();
  initHeroObserver();
  if (mapInstance) {
    mapInstance.setCooperativeGestures(!media.desktop.matches);
    window.requestAnimationFrame(() => mapInstance.resize());
  }
});

media.reducedMotion.addEventListener("change", () => {
  syncMotionPreference();
  initRevealObserver();
});

window.addEventListener("resize", () => {
  window.requestAnimationFrame(() => {
    syncGalleryControls(galleryIndex);
    if (mapInstance) {
      mapInstance.resize();
      if (!selectedProject) fitProjectBounds(0);
    }
  });
});

window.addEventListener("pageshow", () => {
  resetInitialScroll();
});

loadAccessibilityState();
positionAccessibilityToggle();
applyAccessibilityState();
setCookieBannerState(!["accepted", "essential"].includes(settingsStorage.getItem(cookieConsentStorageKey)));
resetInitialScroll();
initIntro();
initHeroObserver();
initMapbox();
