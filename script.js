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
  return localStorage.getItem(cookieConsentStorageKey) === "accepted";
}

function applyAccessibilityState() {
  document.documentElement.style.setProperty("--font-size-base", `${state.fontScale}%`);
  document.body.classList.toggle(bodyClassMap.highContrast, state.highContrast);
  document.body.classList.toggle(bodyClassMap.readableFont, state.readableFont);
  document.body.classList.toggle(bodyClassMap.underlineLinks, state.underlineLinks);
  document.body.classList.toggle(bodyClassMap.stopMotion, state.stopMotion);
  syncMotionPreference();
  localStorage.setItem(accessibilityStorageKey, JSON.stringify(state));
}

function syncMotionPreference() {
  document.documentElement.classList.toggle("motion-enabled", !shouldReduceMotion());
}

function loadAccessibilityState() {
  const savedState = localStorage.getItem(accessibilityStorageKey);
  if (!savedState) return;

  try {
    Object.assign(state, JSON.parse(savedState));
  } catch {
    localStorage.removeItem(accessibilityStorageKey);
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

async function initMapbox() {
  if (!projectsMapElement || mapInstance || !hasCookieConsent()) return;
  try {
    await loadMapAssets();
    if (!hasCookieConsent() || mapInstance || !window.mapboxgl) return;

    window.mapboxgl.accessToken = mapboxToken;

    mapInstance = new window.mapboxgl.Map({
      container: projectsMapElement,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [34.5969, 31.5242],
      zoom: 11.4,
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

    const marker = new window.mapboxgl.Marker({ color: "#d2a566" })
      .setLngLat([34.5969, 31.5242])
      .setPopup(
        new window.mapboxgl.Popup({ offset: 18, focusAfterOpen: false }).setHTML(
          "<strong>עסיס הנדסה ומבנים</strong>",
        ),
      )
      .addTo(mapInstance);

    marker.togglePopup();

    mapInstance.on("load", () => {
      projectsMapShell?.classList.add("is-active");
      mapInstance.resize();
    });
  } catch {
    const placeholder = document.getElementById("projects-map-placeholder");
    if (placeholder && hasCookieConsent()) {
      placeholder.textContent = "המפה אינה זמינה כרגע. ניתן ליצור קשר בטלפון.";
    }
  }
}

function acceptCookies() {
  localStorage.setItem(cookieConsentStorageKey, "accepted");
  setCookieBannerState(false);
  syncMotionPreference();
  initRevealObserver();
  initMapbox();
}

function rejectOptionalCookies() {
  localStorage.setItem(cookieConsentStorageKey, "essential");
  setCookieBannerState(false);
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = undefined;
  }
  projectsMapShell?.classList.remove("is-active");
  const placeholder = document.getElementById("projects-map-placeholder");
  if (placeholder) placeholder.textContent = "אשרו שירותים חיצוניים בהגדרות הפרטיות כדי לטעון את המפה";
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
  if (mapInstance) {
    window.requestAnimationFrame(() => mapInstance.resize());
  }
});

window.addEventListener("pageshow", () => {
  resetInitialScroll();
});

loadAccessibilityState();
positionAccessibilityToggle();
applyAccessibilityState();
setCookieBannerState(!["accepted", "essential"].includes(localStorage.getItem(cookieConsentStorageKey)));
resetInitialScroll();
initIntro();
initHeroObserver();
initMapbox();
