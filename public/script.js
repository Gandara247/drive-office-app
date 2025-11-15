const alertsEl = document.getElementById("alerts");
const foldersListEl = document.getElementById("foldersList");
const filesListEl = document.getElementById("filesList");
const breadcrumbsEl = document.getElementById("breadcrumbs");
const createFolderForm = document.getElementById("createFolderForm");
const uploadForm = document.getElementById("uploadForm");
const refreshBtn = document.getElementById("refreshBtn");
const transfersCard = document.getElementById("transfersCard");
const transfersListEl = document.getElementById("transfersList");
const clearTransfersBtn = document.getElementById("clearTransfers");
const appShellEl = document.getElementById("appShell");
const authGateEl = document.getElementById("authGate");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfoEl = document.getElementById("userInfo");
const userAreaEl = document.getElementById("userArea");

const AUTO_REFRESH_INTERVAL = 10000;
let autoRefreshTimer = null;
let isLoadingFolder = false;

const state = {
  user: null,
  currentFolder: null,
  rootFolderId: null,
  breadcrumbs: [],
  folders: [],
  files: [],
  transfers: []
};

const createId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDate = (value) => {
  if (!value) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(Number(bytes))) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
};

const formatUser = (user) =>
  user?.displayName || user?.emailAddress || "Usuário desconhecido";

const formatOwner = (owners = []) =>
  owners.length ? formatUser(owners[0]) : "Usuário desconhecido";

const showAlert = (message, type = "success", timeout = 4000) => {
  if (!alertsEl) return;
  const div = document.createElement("div");
  div.className = `alert ${type}`;
  div.textContent = message;
  alertsEl.appendChild(div);
  if (timeout) {
    setTimeout(() => div.remove(), timeout);
  }
};

const updateProtectedAreas = () => {
  if (state.user) {
    authGateEl?.classList.add("hidden");
    appShellEl?.classList.remove("hidden");
    userAreaEl?.classList.remove("hidden");
  } else {
    authGateEl?.classList.remove("hidden");
    appShellEl?.classList.add("hidden");
    userAreaEl?.classList.add("hidden");
  }
};

const setUser = (user) => {
  state.user = user || null;
  if (userInfoEl) {
    userInfoEl.textContent = user
      ? `${user.name || user.email} (${user.email})`
      : "-";
  }
  updateProtectedAreas();
};

const resetAppData = () => {
  state.currentFolder = null;
  state.rootFolderId = null;
  state.breadcrumbs = [];
  state.folders = [];
  state.files = [];
  state.transfers = [];
  render();
};

const clearAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};

const scheduleAutoRefresh = () => {
  if (!state.user) return;
  clearAutoRefresh();
  autoRefreshTimer = setTimeout(() => {
    loadFolder(state.currentFolder?.id, { silent: true });
  }, AUTO_REFRESH_INTERVAL);
};

const handleUnauthorized = (message, type = "error") => {
  clearAutoRefresh();
  setUser(null);
  resetAppData();
  if (message) {
    showAlert(message, type, 6000);
  }
};

const fetchSessionUser = async () => {
  try {
    const response = await fetch("/me", { cache: "no-store" });
    if (response.status === 401) {
      setUser(null);
      return null;
    }
    const data = await response.json();
    setUser(data.user);
    return data.user;
  } catch (error) {
    console.error(error);
    setUser(null);
    return null;
  }
};

const ensureAuthenticated = async () => {
  if (state.user) return true;
  const user = await fetchSessionUser();
  return !!user;
};

const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (response.status === 401) {
    handleUnauthorized("Sessão expirada. Faça login novamente.");
    throw new Error("Não autenticado");
  }
  return response;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetchWithAuth(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro ao executar a requisição.");
  }
  return data;
};

const updateBreadcrumbs = (currentFolder) => {
  const label =
    currentFolder?.name ||
    (currentFolder?.id === state.rootFolderId
      ? "Pasta principal"
      : "Sem nome");

  if (!state.breadcrumbs.length) {
    state.breadcrumbs = [{ id: currentFolder.id, name: label }];
    return;
  }

  const existingIndex = state.breadcrumbs.findIndex(
    (crumb) => crumb.id === currentFolder.id
  );

  if (existingIndex >= 0) {
    state.breadcrumbs = state.breadcrumbs.slice(0, existingIndex + 1);
    state.breadcrumbs[existingIndex].name = label;
  } else {
    state.breadcrumbs.push({ id: currentFolder.id, name: label });
  }
};

const renderBreadcrumbs = () => {
  breadcrumbsEl.innerHTML = "";
  state.breadcrumbs.forEach((crumb, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = crumb.name;
    if (index === state.breadcrumbs.length - 1) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => loadFolder(crumb.id));
    breadcrumbsEl.appendChild(btn);
  });
};

const renderFolders = () => {
  foldersListEl.innerHTML = "";
  if (!state.folders.length) {
    foldersListEl.innerHTML =
      '<p class="empty">Nenhuma subpasta encontrada.</p>';
    return;
  }

  state.folders.forEach((folder) => {
    const item = document.createElement("div");
    item.className = "item";

    const owner = formatOwner(folder.owners);
    const modifier = formatUser(folder.lastModifyingUser) || owner;

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${folder.name}</strong>
      <div class="meta">
        <span>Criado por <b>${owner}</b></span>
        <span>Atualizado por <b>${modifier}</b></span>
      </div>
      <small>Modificado em ${formatDate(
        folder.modifiedTime || folder.createdTime
      )}</small>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Abrir";
    openBtn.addEventListener("click", () => loadFolder(folder.id));

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.classList.add("ghost");
    renameBtn.textContent = "Renomear";
    renameBtn.addEventListener("click", () => renameFolder(folder));

    actions.append(openBtn, renameBtn);
    item.append(info, actions);
    foldersListEl.appendChild(item);
  });
};

const renderFiles = () => {
  filesListEl.innerHTML = "";
  if (!state.files.length) {
    filesListEl.innerHTML = '<p class="empty">Nenhum arquivo nesta pasta.</p>';
    return;
  }

  state.files.forEach((file) => {
    const item = document.createElement("div");
    item.className = "item";

    const owner = formatOwner(file.owners);
    const modifier = formatUser(file.lastModifyingUser) || owner;

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${file.name}</strong>
      <div class="chip">${file.mimeType || "Arquivo"}</div>
      <div class="meta">
        <span>Enviado por <b>${owner}</b></span>
        <span>Atualizado por <b>${modifier}</b></span>
      </div>
      <small>Atualizado em ${formatDate(
        file.modifiedTime || file.createdTime
      )}</small>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.textContent = "Baixar";
    downloadBtn.addEventListener("click", () => handleDownload(file));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("ghost");
    deleteBtn.textContent = "Remover";
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm(`Deseja remover o arquivo "${file.name}"?`)) return;
      try {
        await fetchJson(`/files/${file.id}`, { method: "DELETE" });
        showAlert("Arquivo removido com sucesso.");
        await loadFolder(state.currentFolder.id);
      } catch (error) {
        console.error(error);
        showAlert(error.message, "error");
      }
    });

    actions.append(downloadBtn, deleteBtn);
    item.append(info, actions);
    filesListEl.appendChild(item);
  });
};

const renderTransfers = () => {
  if (!state.transfers.length) {
    transfersCard?.classList.add("hidden");
    return;
  }
  transfersCard?.classList.remove("hidden");
  if (!transfersListEl) return;

  transfersListEl.innerHTML = "";
  state.transfers.forEach((transfer) => {
    const wrapper = document.createElement("div");
    wrapper.className = "progress-item";

    const header = document.createElement("div");
    header.className = "progress-header";
    header.innerHTML = `<strong>${transfer.name}</strong><span>${
      transfer.type === "upload" ? "Upload" : "Download"
    }</span>`;

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const barInner = document.createElement("span");
    barInner.style.width = `${Math.min(transfer.progress || 0, 100)}%`;
    bar.append(barInner);

    const status = document.createElement("div");
    status.className = "progress-status";
    if (transfer.status === "error") {
      status.textContent = transfer.message || "Erro na transferência";
    } else if (transfer.status === "completed") {
      status.textContent = "Concluído";
    } else if (typeof transfer.progress === "number") {
      status.textContent = `${transfer.progress}%${
        transfer.size ? ` • ${formatBytes(transfer.size)}` : ""
      }`;
    } else {
      status.textContent = "Em andamento...";
    }

    wrapper.append(header, bar, status);
    transfersListEl.appendChild(wrapper);
  });
};

const addTransfer = ({ type, name, size }) => {
  const transfer = {
    id: createId(),
    type,
    name,
    size: size || null,
    progress: 0,
    status: "running",
    message: ""
  };
  state.transfers.unshift(transfer);
  renderTransfers();
  return transfer.id;
};

const updateTransfer = (id, updates) => {
  const transfer = state.transfers.find((t) => t.id === id);
  if (!transfer) return;
  Object.assign(transfer, updates);
  renderTransfers();
};

const render = () => {
  renderBreadcrumbs();
  renderFolders();
  renderFiles();
  renderTransfers();
};

const loadFolder = async (folderId, options = {}) => {
  if (isLoadingFolder) return;
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;

  isLoadingFolder = true;
  try {
    const target = folderId || state.currentFolder?.id || "";
    const foldersData = await fetchJson(
      target ? `/folders?parentId=${encodeURIComponent(target)}` : "/folders"
    );
    state.currentFolder = foldersData.currentFolder;
    state.rootFolderId = foldersData.rootFolderId;
    state.folders = foldersData.folders;
    updateBreadcrumbs(foldersData.currentFolder);

    const filesData = await fetchJson(
      `/files?folderId=${encodeURIComponent(state.currentFolder.id)}`
    );
    state.files = filesData.files;

    render();
  } catch (error) {
    console.error(error);
    if (!options.silent) {
      showAlert(error.message, "error", 6000);
    }
  } finally {
    isLoadingFolder = false;
    if (!options.skipAutoRefresh) {
      scheduleAutoRefresh();
    }
  }
};

const renameFolder = async (folder) => {
  if (!(await ensureAuthenticated())) return;
  const newName = window.prompt("Novo nome para a pasta:", folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) {
    return;
  }
  try {
    await fetchJson(`/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });
    showAlert("Pasta renomeada com sucesso!");
    await loadFolder(state.currentFolder.id);
  } catch (error) {
    console.error(error);
    showAlert(error.message, "error");
  }
};

createFolderForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;
  const formData = new FormData(createFolderForm);
  const name = formData.get("folderName");
  if (!name) return;
  try {
    await fetchJson("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentId: state.currentFolder?.id
      })
    });
    createFolderForm.reset();
    showAlert("Pasta criada com sucesso!");
    await loadFolder(state.currentFolder.id);
  } catch (error) {
    console.error(error);
    showAlert(error.message, "error");
  }
});

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;

  const fileInput = uploadForm.querySelector('input[type="file"]');
  if (!fileInput || !fileInput.files.length) {
    showAlert("Selecione um arquivo para enviar.", "error");
    return;
  }
  const file = fileInput.files[0];
  const formData = new FormData(uploadForm);
  formData.append("folderId", state.currentFolder?.id);

  const transferId = addTransfer({
    type: "upload",
    name: file.name,
    size: file.size
  });

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateTransfer(transferId, { progress: percent });
        }
      };

      xhr.onerror = () => {
        const message = "Erro na conexão durante o upload.";
        updateTransfer(transferId, { status: "error", message });
        reject(new Error(message));
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          updateTransfer(transferId, {
            status: "error",
            message: "Sessão expirada."
          });
          handleUnauthorized("Sessão expirada. Faça login novamente.");
          reject(new Error("Não autenticado"));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          updateTransfer(transferId, { progress: 100, status: "completed" });
          try {
            const data = JSON.parse(xhr.responseText || "{}");
            if (
              data?.file &&
              state.currentFolder &&
              (!formData.get("folderId") ||
                formData.get("folderId") === state.currentFolder.id)
            ) {
              state.files = [data.file, ...state.files];
              renderFiles();
            }
          } catch {
            // ignora erro de parse
          }
          resolve();
        } else {
          let message = "Erro ao enviar arquivo.";
          try {
            const error = JSON.parse(xhr.responseText || "{}");
            message = error.error || message;
          } catch {
            // ignore
          }
          updateTransfer(transferId, { status: "error", message });
          reject(new Error(message));
        }
      };

      xhr.send(formData);
    });

    uploadForm.reset();
    showAlert("Arquivo enviado com sucesso!");
    await loadFolder(state.currentFolder.id);
  } catch (error) {
    console.error(error);
    if (error.message !== "Não autenticado") {
      showAlert(error.message, "error", 6000);
    }
  }
});

refreshBtn?.addEventListener("click", async () => {
  if (!(await ensureAuthenticated())) return;
  loadFolder(state.currentFolder?.id);
});

async function handleDownload(file) {
  if (!(await ensureAuthenticated())) return;

  const transferId = addTransfer({
    type: "download",
    name: file.name,
    size: Number(file.size) || null
  });

  try {
    const response = await fetch(`/download/${file.id}`);
    if (response.status === 401) {
      handleUnauthorized("Sessão expirada. Faça login novamente.");
      updateTransfer(transferId, { status: "error", message: "Sessão expirada" });
      return;
    }

    if (!response.ok || !response.body) {
      window.open(`/download/${file.id}`, "_blank");
      updateTransfer(transferId, { progress: 100, status: "completed" });
      return;
    }

    const contentLength =
      Number(response.headers.get("Content-Length")) ||
      Number(file.size) ||
      null;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength) {
        const percent = Math.round((received / contentLength) * 100);
        updateTransfer(transferId, { progress: percent });
      } else if (file.size) {
        const percent = Math.min(
          Math.round((received / Number(file.size)) * 100),
          99
        );
        updateTransfer(transferId, { progress: percent });
      }
    }

    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    updateTransfer(transferId, { progress: 100, status: "completed" });
  } catch (error) {
    console.error(error);
    updateTransfer(transferId, { status: "error", message: error.message });
    showAlert(error.message, "error");
  }
}

clearTransfersBtn?.addEventListener("click", () => {
  state.transfers = state.transfers.filter((t) => t.status === "running");
  renderTransfers();
});

loginBtn?.addEventListener("click", async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = "Redirecionando...";
  try {
    const response = await fetch("/auth");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível iniciar o login.");
    }
    if (data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      throw new Error("Resposta inválida do servidor.");
    }
  } catch (error) {
    console.error(error);
    showAlert(error.message, "error");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar com Google";
  }
});

logoutBtn?.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    await fetch("/logout", { method: "POST" });
  } catch (error) {
    console.error(error);
  } finally {
    logoutBtn.disabled = false;
    handleUnauthorized("Sessão encerrada.", "success");
  }
});

const init = async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "success") {
    showAlert("Autenticação concluída com sucesso.", "success");
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const user = await fetchSessionUser();
  if (user) {
    await loadFolder();
  } else {
    updateProtectedAreas();
  }
};

init();
