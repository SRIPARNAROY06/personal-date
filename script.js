"use strict";

const loader = document.querySelector("#loader");
const app = document.querySelector("#app");
const invitation = document.querySelector("#invitation");
const approval = document.querySelector("#approval");
const acceptButton = document.querySelector("#accept-button");
const declineButton = document.querySelector("#decline-button");
const declineButtonHome = declineButton.parentElement;
const declineLabel = declineButton.querySelector(".decline-label");
const declineEmoji = declineButton.querySelector(".decline-emoji");
const declineToast = document.querySelector("#decline-toast");
const thesisToggle = document.querySelector("#thesis-toggle");
const thesis = document.querySelector("#thesis");
const confettiCanvas = document.querySelector("#confetti");
const heartLayer = document.querySelector("#heart-layer");
const dateForm = document.querySelector("#date-form");
const dateChoice = document.querySelector("#date-choice");
const confirmDateButton = document.querySelector("#confirm-date");
const dateOptions = document.querySelectorAll(".date-option");
const scheduleResult = document.querySelector("#schedule-result");
const selectedDate = document.querySelector("#selected-date");
const deliveryStatus = document.querySelector("#delivery-status");
const shareDateButton = document.querySelector("#share-date");
const addCalendarButton = document.querySelector("#add-calendar");

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mljdoqnr";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const introDuration = reducedMotion ? 1800 : 2850;
const declineMessages = [
  "Decline order rejected. 😌",
  "404: Bearish sentiment not found.",
  "Risk assessment says NO is too risky.",
  "Nice try, Krish. 👀",
  "Market manipulation detected.",
  "Insufficient liquidity to execute this order."
];
const declineOptions = [
  { label: "DECLINE", emoji: "🙃" },
  { label: "NOPE?", emoji: "🏃‍♂️" },
  { label: "SELL?", emoji: "📉" },
  { label: "DUMBELL ANBO?", emoji: "🏋️‍♂️" },
  { label: "BHUL OPTION", emoji: "😡" },
  { label: "YOU CAN’T SHORT THIS POSITION", emoji: "😭", desperate: true }
];

let declineAttempts = 0;
let toastTimer;
let hasAccepted = false;
let scheduledDate = null;
let declineMoveLocked = false;
let lastScrollY = window.scrollY;

async function sendFormspreeResponse(fields) {
  const formData = new FormData();
  Object.entries(fields).forEach(([name, value]) => formData.append(name, value));

  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    body: formData,
    headers: { Accept: "application/json" }
  });

  if (!response.ok) throw new Error(`Formspree returned ${response.status}`);
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getUpcomingWeekday(weekday, weekOffset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  let daysAhead = (weekday - date.getDay() + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  date.setDate(date.getDate() + daysAhead + weekOffset * 7);
  return date;
}

// Populate suggestions at runtime so the static GitHub Pages site never goes stale.
dateChoice.min = toDateValue(new Date());
dateOptions.forEach((option) => {
  const date = getUpcomingWeekday(Number(option.dataset.weekday), Number(option.dataset.weekOffset));
  option.dataset.date = toDateValue(date);
  option.querySelector("strong").textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  option.addEventListener("click", () => {
    dateChoice.value = option.dataset.date;
    dateChoice.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

dateChoice.addEventListener("change", () => {
  confirmDateButton.disabled = !dateChoice.value;
  dateOptions.forEach((option) => option.classList.toggle("is-selected", option.dataset.date === dateChoice.value));
  if (scheduledDate && toDateValue(scheduledDate) !== dateChoice.value) {
    scheduledDate = null;
    scheduleResult.hidden = true;
    confirmDateButton.textContent = "LOCK IN THIS DATE ❤️";
  }
});

// Swap the terminal for the invitation after the opening sequence completes.
window.setTimeout(() => {
  loader.classList.add("is-exiting");
  app.hidden = false;
  requestAnimationFrame(() => app.classList.add("is-ready"));
  window.setTimeout(() => loader.remove(), 600);
}, introDuration);

function getViewport() {
  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
    left: 0,
    top: 0
  };
}

function rectanglesOverlap(first, second, padding = 0) {
  return !(
    first.right + padding < second.left ||
    first.left - padding > second.right ||
    first.bottom + padding < second.top ||
    first.top - padding > second.bottom
  );
}

function updateDeclineLabel() {
  const option = declineOptions[declineAttempts % declineOptions.length];
  declineLabel.textContent = option.label;
  declineEmoji.textContent = option.emoji;
  declineButton.classList.toggle("is-desperate", Boolean(option.desperate));
}

function resetDeclineButton() {
  if (!declineButton.classList.contains("is-running") || hasAccepted) return;

  declineAttempts = 0;
  declineMoveLocked = false;
  declineButtonHome.appendChild(declineButton);
  declineButton.classList.remove("is-running", "is-desperate");
  declineButton.style.removeProperty("left");
  declineButton.style.removeProperty("top");
  declineButton.style.removeProperty("width");
  declineButton.style.removeProperty("height");
  updateDeclineLabel();
  window.clearTimeout(toastTimer);
  declineToast.classList.remove("is-visible");
  declineToast.textContent = "";
}

function showDeclineMessage() {
  declineToast.textContent = declineMessages[(declineAttempts - 1) % declineMessages.length];
  declineToast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => declineToast.classList.remove("is-visible"), 1500);
}

// Move away from the pointer inside a compact zone around the decision controls.
function moveDeclineButton(pointerX, pointerY, forceMove = false) {
  if (hasAccepted || (declineMoveLocked && !forceMove)) return;

  declineMoveLocked = true;
  window.setTimeout(() => {
    declineMoveLocked = false;
  }, 350);

  declineAttempts += 1;
  updateDeclineLabel();
  showDeclineMessage();

  const currentRect = declineButton.getBoundingClientRect();
  if (!declineButton.classList.contains("is-running")) {
    lastScrollY = window.scrollY;
    declineButton.style.width = `${currentRect.width}px`;
    declineButton.style.height = `${currentRect.height}px`;
    document.body.appendChild(declineButton);
    declineButton.style.left = `${currentRect.left}px`;
    declineButton.style.top = `${currentRect.top}px`;
    declineButton.classList.add("is-running");
  }

  const viewport = getViewport();
  const margin = 12;
  const buttonWidth = declineButton.offsetWidth;
  const buttonHeight = declineButton.offsetHeight;
  const cursorX = Number.isFinite(pointerX) ? pointerX : currentRect.left + currentRect.width / 2;
  const cursorY = Number.isFinite(pointerY) ? pointerY : currentRect.top + currentRect.height / 2;
  const currentCursorDistance = Math.hypot(
    currentRect.left + currentRect.width / 2 - cursorX,
    currentRect.top + currentRect.height / 2 - cursorY
  );
  const acceptRect = acceptButton.getBoundingClientRect();
  const actionRect = declineButtonHome.getBoundingClientRect();
  const acceptCenterX = acceptRect.left + acceptRect.width / 2;
  const acceptCenterY = acceptRect.top + acceptRect.height / 2;
  const viewportMinX = viewport.left + margin;
  const viewportMinY = viewport.top + margin;
  const viewportMaxX = Math.max(viewportMinX, viewport.left + viewport.width - buttonWidth - margin);
  const viewportMaxY = Math.max(viewportMinY, viewport.top + viewport.height - buttonHeight - margin);
  const zoneWidth = Math.min(560, viewport.width - margin * 2);
  const zoneHeight = Math.min(300, viewport.height - margin * 2);
  const zoneCenterX = actionRect.left + actionRect.width / 2;
  const zoneCenterY = actionRect.top + actionRect.height / 2;
  let minTravel = 70;
  let maxTravel = Math.min(155, viewport.width * 0.36);
  let minX = Math.max(viewportMinX, zoneCenterX - zoneWidth / 2);
  let minY = Math.max(viewportMinY, zoneCenterY - zoneHeight / 2);
  let maxX = Math.max(minX, Math.min(viewportMaxX, zoneCenterX + zoneWidth / 2 - buttonWidth));
  let maxY = Math.max(minY, Math.min(viewportMaxY, zoneCenterY + zoneHeight / 2 - buttonHeight));

  if (buttonWidth > viewport.width * 0.6) {
    minTravel = 36;
    maxTravel = 95;
    minX = viewportMinX;
    maxX = viewportMaxX;

    const belowAccept = acceptRect.bottom + 12;
    if (viewportMaxY - belowAccept >= minTravel) {
      minY = belowAccept;
      maxY = Math.min(viewportMaxY, minY + 70);
    } else {
      maxY = Math.min(viewportMaxY, acceptRect.top - buttonHeight - 12);
      minY = Math.max(viewportMinY, maxY - 70);
    }
  }
  let candidate = null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minTravel + Math.random() * (maxTravel - minTravel);
    const left = Math.min(Math.max(currentRect.left + Math.cos(angle) * distance, minX), maxX);
    const top = Math.min(Math.max(currentRect.top + Math.sin(angle) * distance, minY), maxY);
    const nextCandidate = {
      left,
      top,
      right: left + buttonWidth,
      bottom: top + buttonHeight
    };
    const actualTravel = Math.hypot(left - currentRect.left, top - currentRect.top);

    const cursorDistance = Math.hypot(
      left + buttonWidth / 2 - cursorX,
      top + buttonHeight / 2 - cursorY
    );

    if (
      actualTravel >= minTravel &&
      cursorDistance > currentCursorDistance + minTravel * 0.35 &&
      !rectanglesOverlap(nextCandidate, acceptRect, 8)
    ) {
      candidate = nextCandidate;
      break;
    }
  }

  if (!candidate) {
    const fallbackPoints = [
      [minX, currentRect.top],
      [maxX, currentRect.top],
      [currentRect.left, minY],
      [currentRect.left, maxY],
      [minX, minY],
      [maxX, minY],
      [minX, maxY],
      [maxX, maxY]
    ]
      .map(([left, top]) => ({
        left: Math.min(Math.max(left, minX), maxX),
        top: Math.min(Math.max(top, minY), maxY)
      }))
      .map((point) => ({
        ...point,
        right: point.left + buttonWidth,
        bottom: point.top + buttonHeight,
        travel: Math.hypot(point.left - currentRect.left, point.top - currentRect.top),
        cursorDistance: Math.hypot(
          point.left + buttonWidth / 2 - cursorX,
          point.top + buttonHeight / 2 - cursorY
        )
      }))
      .filter((point) => point.travel >= minTravel && !rectanglesOverlap(point, acceptRect, 8))
      .sort((first, second) => second.cursorDistance - first.cursorDistance);

    candidate = fallbackPoints[0];
  }

  if (!candidate) return;

  declineButton.style.left = `${candidate.left}px`;
  declineButton.style.top = `${candidate.top}px`;
}

declineButton.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "touch") moveDeclineButton(event.clientX, event.clientY);
});

declineButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  moveDeclineButton(event.clientX, event.clientY, true);
});

declineButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

document.addEventListener("pointermove", (event) => {
  if (!declineButton.classList.contains("is-running") || hasAccepted) return;
  const rect = declineButton.getBoundingClientRect();
  const nearestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
  const nearestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
  const distance = Math.hypot(event.clientX - nearestX, event.clientY - nearestY);
  if (distance < 70) moveDeclineButton(event.clientX, event.clientY);
});

declineButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  moveDeclineButton(undefined, undefined, true);
});

function keepDeclineButtonVisible() {
  if (!declineButton.classList.contains("is-running") || hasAccepted) return;
  const viewport = getViewport();
  const rect = declineButton.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(
    Math.max(rect.left, viewport.left + margin),
    viewport.left + viewport.width - rect.width - margin
  );
  const top = Math.min(
    Math.max(rect.top, viewport.top + margin),
    viewport.top + viewport.height - rect.height - margin
  );
  declineButton.style.left = `${left}px`;
  declineButton.style.top = `${top}px`;
}

window.addEventListener("resize", keepDeclineButtonVisible);
window.visualViewport?.addEventListener("resize", keepDeclineButtonVisible);
window.addEventListener("wheel", (event) => {
  if (event.deltaY < 0) resetDeclineButton();
}, { passive: true });
window.addEventListener("scroll", () => {
  const currentScrollY = window.scrollY;
  if (currentScrollY < lastScrollY - 8) resetDeclineButton();
  lastScrollY = currentScrollY;
}, { passive: true });

thesisToggle.addEventListener("click", () => {
  const willOpen = thesis.hidden;
  thesis.hidden = !willOpen;
  thesisToggle.setAttribute("aria-expanded", String(willOpen));
  thesisToggle.firstChild.textContent = willOpen ? "Close Investment Thesis " : "View Investment Thesis ";
});

function playSuccessSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + index * 0.09;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  });
}

function releaseHearts() {
  if (reducedMotion) return;
  for (let index = 0; index < 18; index += 1) {
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = index % 4 === 0 ? "♡" : "♥";
    heart.style.left = `${5 + Math.random() * 90}%`;
    heart.style.fontSize = `${14 + Math.random() * 22}px`;
    heart.style.setProperty("--duration", `${3.5 + Math.random() * 2.2}s`);
    heart.style.setProperty("--delay", `${Math.random() * 1.2}s`);
    heart.style.setProperty("--drift", `${-60 + Math.random() * 120}px`);
    heart.style.setProperty("--spin", `${-80 + Math.random() * 160}deg`);
    heartLayer.appendChild(heart);
    window.setTimeout(() => heart.remove(), 7000);
  }
}

function launchConfetti() {
  if (reducedMotion) return;
  const context = confettiCanvas.getContext("2d");
  if (!context) return;

  const colors = ["#e62429", "#ff5a63", "#2478e5", "#4d8dff", "#f5f8ff"];
  const particles = Array.from({ length: 120 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
    y: window.innerHeight * 0.36,
    velocityX: (Math.random() - 0.5) * 13,
    velocityY: -6 - Math.random() * 11,
    size: 3 + Math.random() * 6,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.25,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1
  }));

  function resizeCanvas() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = window.innerWidth * scale;
    confettiCanvas.height = window.innerHeight * scale;
    confettiCanvas.style.width = `${window.innerWidth}px`;
    confettiCanvas.style.height = `${window.innerHeight}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  resizeCanvas();
  const startedAt = performance.now();

  function drawFrame(now) {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      particle.velocityY += 0.22;
      particle.velocityX *= 0.995;
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.rotation += particle.rotationSpeed;
      if (now - startedAt > 2200) particle.alpha -= 0.018;

      context.save();
      context.globalAlpha = Math.max(0, particle.alpha);
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 3, particle.size, particle.size * 0.66);
      context.restore();
    });

    if (now - startedAt < 3600) {
      requestAnimationFrame(drawFrame);
    } else {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  requestAnimationFrame(drawFrame);
}

dateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dateForm.reportValidity()) return;

  scheduledDate = parseDateValue(dateChoice.value);
  const formattedDate = scheduledDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  selectedDate.textContent = formattedDate;
  scheduleResult.hidden = false;
  deliveryStatus.textContent = "Sending your answer securely...";
  confirmDateButton.disabled = true;
  confirmDateButton.textContent = "SENDING DATE...";
  scheduleResult.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });

  try {
    await sendFormspreeResponse({
      name: "Krish",
      response: "ACCEPTED",
      event: "Date confirmed",
      selected_date: dateChoice.value,
      selected_date_formatted: formattedDate,
      submitted_at: new Date().toISOString()
    });
    deliveryStatus.textContent = "Delivered. She now knows when to clear her calendar. 😌";
    confirmDateButton.textContent = "DATE SENT ✓";
  } catch (error) {
    console.error("Could not send the selected date:", error);
    deliveryStatus.textContent = "Couldn’t send automatically. Check your connection, then tap retry.";
    confirmDateButton.disabled = false;
    confirmDateButton.textContent = "RETRY SENDING DATE";
  }
});

shareDateButton.addEventListener("click", async () => {
  if (!scheduledDate) return;
  const formattedDate = selectedDate.textContent;
  const text = `Investment approved: I’m free on ${formattedDate}. Date portfolio allocation: 100% us. ❤️`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Our date", text });
    } else {
      await navigator.clipboard.writeText(text);
      shareDateButton.textContent = "COPIED — SEND IT TO ME";
    }
  } catch (error) {
    if (error.name !== "AbortError") shareDateButton.textContent = "DATE READY TO SEND";
  }
});

addCalendarButton.addEventListener("click", () => {
  if (!scheduledDate) return;

  const endDate = new Date(scheduledDate);
  endDate.setDate(endDate.getDate() + 1);
  const formatCalendarDate = (date) => toDateValue(date).replaceAll("-", "");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Krish Date//Date Request//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@krish-date`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${formatCalendarDate(scheduledDate)}`,
    `DTEND;VALUE=DATE:${formatCalendarDate(endDate)}`,
    "SUMMARY:Krish + Me: One Entire Day ❤️",
    "DESCRIPTION:Investment approved. Dinner mandatory. Expected ROI: lots of memories.",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const downloadUrl = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "date-with-krish.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

acceptButton.addEventListener("click", () => {
  if (hasAccepted) return;
  hasAccepted = true;
  sendFormspreeResponse({
    name: "Krish",
    response: "ACCEPTED",
    event: "Date request accepted",
    submitted_at: new Date().toISOString()
  }).catch((error) => console.error("Could not record acceptance:", error));
  playSuccessSound();
  launchConfetti();
  releaseHearts();
  declineToast.classList.remove("is-visible");
  declineToast.textContent = "";
  declineButton.classList.add("is-gone");
  invitation.classList.add("is-leaving");

  window.setTimeout(() => {
    invitation.hidden = true;
    declineButton.hidden = true;
    approval.hidden = false;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => approval.classList.add("is-entering"));
  }, reducedMotion ? 0 : 420);
});
