const TOTAL_STEPS = 4;
const DRAFT_KEY = "vm_form_draft_v1";

const form = document.getElementById("leadForm");
const panels = Array.from(document.querySelectorAll(".panel"));
const markers = Array.from(document.querySelectorAll(".step"));
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("formStatus");
const successMessage = document.getElementById("successMessage");
const newSubmissionBtn = document.getElementById("newSubmissionBtn");
const referralOtherField = document.getElementById("referralOtherField");
const referralOtherInput = document.getElementById("referral_source_other");

let currentStep = 1;

const FIELDS = [
  "characteristic",
  "referral_source",
  "referral_source_other",
  "full_name",
  "cpf",
  "phone_primary",
  "phone_secondary",
  "email_primary",
  "email_secondary",
  "birthday_ddmm",
  "address_correspondence",
  "address_project",
  "extra_info",
  "website",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DDMM_RE = /^\d{2}\/\d{2}$/;
const DEFAULT_GOOGLE_FORM_RESPONSE_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSejxdUvCj9TCW94jCCdw3Hc1LzRTn0vwdTeiUnUcxer9lgk0g/formResponse";
const DEFAULT_GOOGLE_FORM_FIELD_MAP = {
  characteristic: "1492110623",
  referral_source: "96262849",
  full_name: "1588080978",
  cpf: "1071998518",
  phone_primary: "1344753239",
  phone_secondary: "985168769",
  email_primary: "1732047197",
  email_secondary: "1375527850",
  birthday_ddmm: "1065165904",
  address_correspondence: "1115535792",
  address_project: "1485250805",
  extra_info: "1991360011",
};

function getApiEndpoint() {
  const path = window.location.pathname || "/";
  if (path === "/") {
    return "/api/submit";
  }
  if (path.endsWith("/index.html")) {
    return `${path.slice(0, -("index.html".length))}api/submit`;
  }
  if (path.endsWith(".html")) {
    const folder = path.slice(0, path.lastIndexOf("/") + 1);
    return `${folder}api/submit`;
  }
  if (path.endsWith("/")) {
    return `${path}api/submit`;
  }
  return `${path}/api/submit`;
}

function getSubmitConfig() {
  const externalConfig =
    window.VM_FORM_CONFIG && typeof window.VM_FORM_CONFIG === "object"
      ? window.VM_FORM_CONFIG
      : {};

  return {
    submitMode: String(externalConfig.submitMode || "local_api").trim().toLowerCase(),
    googleFormResponseUrl: String(
      externalConfig.googleFormResponseUrl || DEFAULT_GOOGLE_FORM_RESPONSE_URL
    ).trim(),
    googleFormFieldMap: {
      ...DEFAULT_GOOGLE_FORM_FIELD_MAP,
      ...(externalConfig.googleFormFieldMap || {}),
    },
  };
}

function buildGoogleFormBody(payload, config) {
  const body = new URLSearchParams();
  const map = config.googleFormFieldMap || {};

  Object.keys(map).forEach((fieldName) => {
    const entryId = String(map[fieldName] || "").trim();
    if (!entryId) return;
    body.set(`entry.${entryId}`, (payload[fieldName] || "").toString());
  });

  const referralEntryId = String(map.referral_source || "").trim();
  if (referralEntryId && payload.referral_source === "Outro" && payload.referral_source_other) {
    body.set(`entry.${referralEntryId}`, "__other_option__");
    body.set(`entry.${referralEntryId}.other_option_response`, payload.referral_source_other);
  }

  return body;
}

async function submitToGoogleForms(payload, config) {
  const formUrl = config.googleFormResponseUrl || DEFAULT_GOOGLE_FORM_RESPONSE_URL;
  const body = buildGoogleFormBody(payload, config);

  await fetch(formUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  });
}

async function submitToLocalApi(payload) {
  const response = await fetch(getApiEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (!response.ok || !result || !result.ok) {
    throw new Error((result && result.message) || "Não foi possível concluir o envio.");
  }
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatCPF(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatBirthday(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 13);
  if (!digits) return "";

  let country = "";
  let local = digits;

  if (digits.startsWith("55") && digits.length > 11) {
    country = "55";
    local = digits.slice(2);
  }

  const ddd = local.slice(0, 2);
  const remainder = local.slice(2);

  let numberPart = remainder;
  if (remainder.length > 5) {
    const split = remainder.length === 8 ? 4 : 5;
    numberPart = `${remainder.slice(0, split)}-${remainder.slice(split)}`;
  }

  let result = "";
  if (ddd) {
    result = `(${ddd}) ${numberPart}`.trim();
  } else {
    result = numberPart;
  }

  if (country) {
    result = `+${country} ${result}`.trim();
  }

  return result;
}

function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) {
    return false;
  }

  let total = 0;
  for (let i = 0; i < 9; i += 1) {
    total += Number(cpf[i]) * (10 - i);
  }

  let check = (total * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;

  total = 0;
  for (let i = 0; i < 10; i += 1) {
    total += Number(cpf[i]) * (11 - i);
  }

  check = (total * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[10])) return false;

  return true;
}

function isValidPhone(value) {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 13;
}

function isValidDDMM(value) {
  if (!value) return true;
  if (!DDMM_RE.test(value)) return false;
  const [dayRaw, monthRaw] = value.split("/");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const dt = new Date(2000, month - 1, day);
  return dt.getFullYear() === 2000 && dt.getMonth() === month - 1 && dt.getDate() === day;
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "success");
  if (kind) statusEl.classList.add(kind);
}

function setFieldInvalid(field, message) {
  field.classList.add("invalid");
  field.setCustomValidity(message);
  field.reportValidity();
}

function clearFieldInvalid(field) {
  field.classList.remove("invalid");
  field.setCustomValidity("");
}

function toggleReferralOther() {
  const source = form.querySelector('input[name="referral_source"]:checked')?.value || "";
  const isOther = source === "Outro";
  referralOtherField.hidden = !isOther;
  referralOtherInput.required = isOther;

  if (!isOther) {
    referralOtherInput.value = "";
    clearFieldInvalid(referralOtherInput);
  }
}

function updateStepUI() {
  panels.forEach((panel) => {
    const step = Number(panel.dataset.step);
    panel.classList.toggle("is-active", step === currentStep);
  });

  markers.forEach((marker) => {
    const markerStep = Number(marker.dataset.marker);
    marker.classList.toggle("is-active", markerStep === currentStep);
  });

  prevBtn.hidden = currentStep === 1;
  nextBtn.hidden = currentStep === TOTAL_STEPS;
  submitBtn.hidden = currentStep !== TOTAL_STEPS;

  saveDraft();
}

function collectStepFields(step) {
  const panel = panels.find((item) => Number(item.dataset.step) === step);
  if (!panel) return [];
  return Array.from(panel.querySelectorAll("input, textarea"));
}

function validateSingleField(field, silent = false) {
  const name = field.name;
  const value = field.value.trim();

  clearFieldInvalid(field);

  if (field.required && !value) {
    if (!silent) setFieldInvalid(field, "Este campo é obrigatório.");
    return false;
  }

  if (!value) return true;

  if (name === "cpf" && !isValidCPF(value)) {
    if (!silent) setFieldInvalid(field, "CPF inválido.");
    return false;
  }

  if ((name === "phone_primary" || name === "phone_secondary") && !isValidPhone(value)) {
    if (!silent) setFieldInvalid(field, "Telefone inválido.");
    return false;
  }

  if ((name === "email_primary" || name === "email_secondary") && !EMAIL_RE.test(value)) {
    if (!silent) setFieldInvalid(field, "E-mail inválido.");
    return false;
  }

  if (name === "birthday_ddmm" && !isValidDDMM(value)) {
    if (!silent) setFieldInvalid(field, "Use o formato dd/mm.");
    return false;
  }

  return true;
}

function validateStep(step, silent = false) {
  const fields = collectStepFields(step);
  let valid = true;

  const requiredRadioNames = new Set(
    fields.filter((field) => field.type === "radio" && field.required).map((field) => field.name)
  );

  requiredRadioNames.forEach((name) => {
    const selected = form.querySelector(`input[name="${name}"]:checked`);
    if (!selected) {
      valid = false;
      if (!silent) {
        setStatus("Selecione uma opção para continuar.", "error");
      }
    }
  });

  fields
    .filter((field) => field.type !== "radio")
    .forEach((field) => {
      const fieldIsValid = validateSingleField(field, silent);
      if (!fieldIsValid) valid = false;
    });

  if (step === 2) {
    toggleReferralOther();
    if (referralOtherInput.required && !validateSingleField(referralOtherInput, silent)) {
      valid = false;
    }
  }

  if (!silent && valid) {
    setStatus("");
  }

  return valid;
}

function validateAllSteps() {
  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    if (!validateStep(step, true)) {
      currentStep = step;
      updateStepUI();
      validateStep(step, false);
      setStatus("Revise os campos destacados para concluir o envio.", "error");
      return false;
    }
  }
  return true;
}

function collectPayload() {
  const formData = new FormData(form);
  const payload = {};

  FIELDS.forEach((field) => {
    payload[field] = (formData.get(field) || "").toString().trim();
  });

  const params = new URLSearchParams(window.location.search);
  payload.utm_source = params.get("utm_source") || "";
  payload.utm_medium = params.get("utm_medium") || "";
  payload.utm_campaign = params.get("utm_campaign") || "";
  payload.utm_term = params.get("utm_term") || "";
  payload.utm_content = params.get("utm_content") || "";
  payload.page_url = window.location.href;
  payload.referrer = document.referrer || "";

  return payload;
}

function saveDraft() {
  const payload = collectPayload();
  payload.current_step = currentStep;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);

    FIELDS.forEach((field) => {
      if (!(field in draft)) return;

      const value = draft[field];
      const radio = form.querySelector(`input[type="radio"][name="${field}"][value="${CSS.escape(value)}"]`);
      if (radio) {
        radio.checked = true;
        return;
      }

      const input = form.querySelector(`[name="${field}"]`);
      if (input && typeof value === "string") {
        input.value = value;
      }
    });

    if (Number.isInteger(Number(draft.current_step))) {
      const step = Number(draft.current_step);
      if (step >= 1 && step <= TOTAL_STEPS) {
        currentStep = step;
      }
    }

    toggleReferralOther();
  } catch (error) {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function attachInputMasks() {
  const cpfInput = document.getElementById("cpf");
  const birthdayInput = document.getElementById("birthday_ddmm");
  const phonePrimary = document.getElementById("phone_primary");
  const phoneSecondary = document.getElementById("phone_secondary");

  cpfInput.addEventListener("input", () => {
    cpfInput.value = formatCPF(cpfInput.value);
  });

  birthdayInput.addEventListener("input", () => {
    birthdayInput.value = formatBirthday(birthdayInput.value);
  });

  [phonePrimary, phoneSecondary].forEach((field) => {
    field.addEventListener("input", () => {
      field.value = formatPhone(field.value);
    });
  });
}

function setLoading(isLoading) {
  prevBtn.disabled = isLoading;
  nextBtn.disabled = isLoading;
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Enviando..." : "Concluir cadastro";
}

function resetFormForNewSubmission() {
  form.reset();
  localStorage.removeItem(DRAFT_KEY);
  currentStep = 1;
  successMessage.hidden = true;
  form.hidden = false;
  setStatus("");
  toggleReferralOther();
  updateStepUI();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateAllSteps()) return;

  setLoading(true);
  setStatus("Enviando cadastro...", "");

  try {
    const payload = collectPayload();
    const config = getSubmitConfig();

    if (config.submitMode === "google_forms") {
      await submitToGoogleForms(payload, config);
    } else {
      await submitToLocalApi(payload);
    }

    localStorage.removeItem(DRAFT_KEY);
    form.hidden = true;
    successMessage.hidden = false;
    setStatus("Cadastro enviado com sucesso.", "success");
  } catch (error) {
    setStatus(error.message || "Erro inesperado ao enviar cadastro.", "error");
  } finally {
    setLoading(false);
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep === 1) return;
  currentStep -= 1;
  updateStepUI();
});

nextBtn.addEventListener("click", () => {
  if (!validateStep(currentStep, false)) return;
  if (currentStep >= TOTAL_STEPS) return;
  currentStep += 1;
  updateStepUI();
});

form.querySelectorAll("input, textarea").forEach((field) => {
  field.addEventListener("input", () => {
    clearFieldInvalid(field);
    saveDraft();
  });

  field.addEventListener("change", () => {
    clearFieldInvalid(field);
    saveDraft();
  });
});

form
  .querySelectorAll('input[name="referral_source"]')
  .forEach((radio) => radio.addEventListener("change", toggleReferralOther));

newSubmissionBtn.addEventListener("click", resetFormForNewSubmission);

restoreDraft();
attachInputMasks();
toggleReferralOther();
updateStepUI();
