(function () {
  "use strict";

  /** @returns {string} YYYY-MM-DD in local timezone */
  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function isoFromYMD(year, monthIndex, day) {
    const m = String(monthIndex + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  /** @param {string} iso @param {number} dayDelta -1 = previous day */
  function addDaysToISO(iso, dayDelta) {
    const { y, m, d } = parseISO(iso);
    const dt = new Date(y, m, d);
    dt.setDate(dt.getDate() + dayDelta);
    return isoFromYMD(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m: m - 1, d };
  }

  function formatDisplayDate(iso) {
    if (!iso) return "";
    const { y, m, d } = parseISO(iso);
    const dt = new Date(y, m, d);
    return dt.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function isImportant(todo) {
    return Boolean(todo.important);
  }

  function sortTodos(arr) {
    return [...arr].sort((a, b) => {
      if (isImportant(a) !== isImportant(b)) return isImportant(a) ? -1 : 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  /** @param {number} year @param {number} monthIndex 0-11 */
  function padCalendarCells(year, monthIndex) {
    const dim = new Date(year, monthIndex + 1, 0).getDate();
    const firstDow = new Date(year, monthIndex, 1).getDay();
    const cells = [];
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const prevDim = new Date(prevYear, prevMonth + 1, 0).getDate();
    for (let i = 0; i < firstDow; i++) {
      const d = prevDim - firstDow + 1 + i;
      cells.push({ y: prevYear, m: prevMonth, d, muted: true });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ y: year, m: monthIndex, d, muted: false });
    }
    const rem = cells.length % 7;
    const endPad = rem === 0 ? 0 : 7 - rem;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
    let nd = 1;
    for (let i = 0; i < endPad; i++) {
      cells.push({ y: nextYear, m: nextMonth, d: nd++, muted: true });
    }
    return cells;
  }

  const appEl = document.querySelector(".app");
  const listDatePicker = document.getElementById("listDatePicker");
  const datePrevMonth = document.getElementById("datePrevMonth");
  const dateNextMonth = document.getElementById("dateNextMonth");
  const btnViewList = document.getElementById("btnViewList");
  const btnViewCalendar = document.getElementById("btnViewCalendar");
  const listPanel = document.getElementById("listPanel");
  const calendarPanel = document.getElementById("calendarPanel");
  const calPrev = document.getElementById("calPrev");
  const calNext = document.getElementById("calNext");
  const calMonthTitle = document.getElementById("calMonthTitle");
  const calWeekdays = document.getElementById("calWeekdays");
  const calendarGrid = document.getElementById("calendarGrid");

  const todoList = document.getElementById("todoList");
  const emptyHint = document.getElementById("emptyHint");
  const btnAddTodo = document.getElementById("btnAddTodo");

  const addModal = document.getElementById("addModal");
  const addModalBackdrop = document.getElementById("addModalBackdrop");
  const addForm = document.getElementById("addForm");
  const addTitle = document.getElementById("addTitle");
  const addDetail = document.getElementById("addDetail");
  const addDate = document.getElementById("addDate");
  const addCancel = document.getElementById("addCancel");

  const detailModal = document.getElementById("detailModal");
  const detailModalBackdrop = document.getElementById("detailModalBackdrop");
  const detailViewMode = document.getElementById("detailViewMode");
  const detailEditForm = document.getElementById("detailEditForm");
  const detailViewTitle = document.getElementById("detailViewTitle");
  const detailViewBody = document.getElementById("detailViewBody");
  const detailViewDate = document.getElementById("detailViewDate");
  const detailViewImportance = document.getElementById("detailViewImportance");
  const detailClose = document.getElementById("detailClose");
  const detailEdit = document.getElementById("detailEdit");
  const detailMarkDone = document.getElementById("detailMarkDone");
  const detailMarkUndone = document.getElementById("detailMarkUndone");
  const editTitle = document.getElementById("editTitle");
  const editDetail = document.getElementById("editDetail");
  const editDate = document.getElementById("editDate");
  const editCancel = document.getElementById("editCancel");

  const deleteModal = document.getElementById("deleteModal");
  const deleteModalBackdrop = document.getElementById("deleteModalBackdrop");
  const deleteYes = document.getElementById("deleteYes");
  const deleteNo = document.getElementById("deleteNo");

  let todos = [];
  let selectedId = null;
  let deleteTargetId = null;

  let selectedListDate = todayISO();
  let viewMode = "list";
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  function isValidISODate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function normalizeSelectedListDate() {
    if (!isValidISODate(selectedListDate)) {
      selectedListDate = todayISO();
    }
  }

  function syncListDatePickerFromState() {
    normalizeSelectedListDate();
    if (listDatePicker) {
      listDatePicker.value = selectedListDate;
    }
  }

  function syncCalMonthFromSelectedDate() {
    normalizeSelectedListDate();
    const { y, m } = parseISO(selectedListDate);
    calYear = y;
    calMonth = m;
  }

  function todosForDate(iso) {
    return sortTodos(todos.filter((x) => x.date === iso));
  }

  function setEditImportanceRadios(important) {
    const v = important ? "important" : "normal";
    const el = detailEditForm.querySelector(`input[name="editImportance"][value="${v}"]`);
    if (el) el.checked = true;
  }

  function openModal(backdrop, modal) {
    backdrop.hidden = false;
    modal.hidden = false;
  }

  function closeModal(backdrop, modal) {
    backdrop.hidden = true;
    modal.hidden = true;
  }

  function showDetailView() {
    detailViewMode.hidden = false;
    detailEditForm.hidden = true;
  }

  function showDetailEdit() {
    detailViewMode.hidden = true;
    detailEditForm.hidden = false;
  }

  /** @param {string} [dateIso] YYYY-MM-DD for pre-filled date when opening from calendar */
  function openAddModal(dateIso) {
    addTitle.value = "";
    addDetail.value = "";
    if (dateIso && isValidISODate(dateIso)) {
      addDate.value = dateIso;
      selectedListDate = dateIso;
      syncListDatePickerFromState();
    } else {
      addDate.value = selectedListDate;
    }
    addForm.querySelector('input[name="importance"][value="normal"]').checked = true;
    openModal(addModalBackdrop, addModal);
    addTitle.focus();
  }

  function openDetailModal(id) {
    const todo = todos.find((x) => x.id === id);
    if (!todo) return;
    selectedId = id;
    showDetailView();
    detailViewTitle.textContent = todo.title;
    detailViewBody.textContent = todo.detail || "(내용 없음)";
    detailViewDate.textContent = formatDisplayDate(todo.date);
    detailViewImportance.textContent = isImportant(todo) ? "중요" : "일반";
    editTitle.value = todo.title;
    editDetail.value = todo.detail || "";
    editDate.value = todo.date;
    setEditImportanceRadios(isImportant(todo));
    openModal(detailModalBackdrop, detailModal);

    detailEdit.hidden = false;
    detailMarkDone.hidden = false;
    detailMarkUndone.hidden = false;
    detailMarkDone.disabled = todo.completed;
    detailMarkUndone.disabled = !todo.completed;
  }

  function openDeleteConfirm(id) {
    deleteTargetId = id;
    openModal(deleteModalBackdrop, deleteModal);
    deleteNo.focus();
  }

  function closeDeleteConfirm() {
    deleteTargetId = null;
    closeModal(deleteModalBackdrop, deleteModal);
  }

  function setViewMode(mode) {
    viewMode = mode;
    const isList = mode === "list";
    btnViewList.classList.toggle("is-active", isList);
    btnViewCalendar.classList.toggle("is-active", !isList);
    btnViewList.setAttribute("aria-pressed", isList ? "true" : "false");
    btnViewCalendar.setAttribute("aria-pressed", isList ? "false" : "true");
    listPanel.hidden = !isList;
    calendarPanel.hidden = isList;
    appEl.classList.toggle("app--calendar", !isList);
    if (!isList) {
      syncCalMonthFromSelectedDate();
    }
  }

  function renderList() {
    const list = todosForDate(selectedListDate);
    todoList.innerHTML = "";

    if (list.length === 0) {
      emptyHint.hidden = false;
      return;
    }
    emptyHint.hidden = true;

    for (const todo of list) {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.completed ? " completed" : "");
      li.dataset.id = todo.id;

      const main = document.createElement("div");
      main.className = "todo-main";

      if (isImportant(todo)) {
        const badge = document.createElement("span");
        badge.className = "badge-important";
        badge.textContent = "중요";
        main.appendChild(badge);
      }

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "todo-title-link";
      titleBtn.textContent = todo.title;
      titleBtn.addEventListener("click", () => {
        openDetailModal(todo.id);
      });
      main.appendChild(titleBtn);

      const actions = document.createElement("div");
      actions.className = "todo-actions";

      const btnDone = document.createElement("button");
      btnDone.type = "button";
      btnDone.className = "btn btn-success" + (todo.completed ? " toggle-done" : "");
      btnDone.textContent = todo.completed ? "미완료" : "완료";
      btnDone.addEventListener("click", (e) => {
        e.stopPropagation();
        todo.completed = !todo.completed;
        render();
      });

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn btn-danger";
      btnDel.textContent = "삭제";
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        openDeleteConfirm(todo.id);
      });

      actions.appendChild(btnDone);
      actions.appendChild(btnDel);

      li.appendChild(main);
      li.appendChild(actions);
      todoList.appendChild(li);
    }
  }

  function renderCalendar() {
    const tIso = todayISO();
    calMonthTitle.textContent = new Date(calYear, calMonth, 1).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
    });

    calendarGrid.innerHTML = "";
    const cells = padCalendarCells(calYear, calMonth);

    for (const c of cells) {
      const iso = isoFromYMD(c.y, c.m, c.d);
      const cell = document.createElement("div");
      cell.className = "cal-cell" + (c.muted ? " cal-cell--muted" : "");
      if (iso === tIso) cell.classList.add("cal-cell--today");

      cell.addEventListener("click", () => openAddModal(iso));

      const num = document.createElement("div");
      num.className = "cal-day-num";
      num.textContent = String(c.d);
      cell.appendChild(num);

      const ul = document.createElement("ul");
      ul.className = "cal-todo-list";

      const dayTodos = sortTodos(todos.filter((x) => x.date === iso));
      for (const todo of dayTodos) {
        const li = document.createElement("li");
        li.className = "cal-todo-item";

        const top = document.createElement("div");
        top.className = "cal-todo-top";

        if (isImportant(todo)) {
          const imp = document.createElement("span");
          imp.className = "cal-important-mark";
          imp.setAttribute("title", "\uC911\uC694 \uC77C\uC815");
          imp.setAttribute("aria-label", "\uC911\uC694");
          imp.innerHTML =
            '<span class="cal-important-star" aria-hidden="true">\u2605</span><span class="cal-important-label">\uC911\uC694</span>';
          top.appendChild(imp);
        }

        const titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "cal-todo-title" + (todo.completed ? " cal-done" : "");
        titleBtn.textContent = todo.title;
        titleBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openDetailModal(todo.id);
        });
        top.appendChild(titleBtn);

        li.appendChild(top);

        const st = document.createElement("span");
        st.className =
          "cal-todo-status " + (todo.completed ? "cal-todo-status--done" : "cal-todo-status--pending");
        st.textContent = todo.completed ? "완료" : "미완료";

        li.appendChild(st);
        li.addEventListener("click", (ev) => ev.stopPropagation());
        ul.appendChild(li);
      }

      cell.appendChild(ul);
      calendarGrid.appendChild(cell);
    }
  }

  function render() {
    syncListDatePickerFromState();

    if (viewMode === "list") {
      renderList();
    } else {
      renderCalendar();
    }
  }

  if (!calWeekdays.dataset.inited) {
    calWeekdays.dataset.inited = "1";
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    calWeekdays.innerHTML = labels.map((l) => `<span>${l}</span>`).join("");
  }

  listDatePicker.addEventListener("change", () => {
    const v = listDatePicker.value;
    selectedListDate = isValidISODate(v) ? v : todayISO();
    syncCalMonthFromSelectedDate();
    render();
  });

  function shiftSelectedDay(delta) {
    normalizeSelectedListDate();
    selectedListDate = addDaysToISO(selectedListDate, delta);
    syncListDatePickerFromState();
    syncCalMonthFromSelectedDate();
    render();
  }

  datePrevMonth.addEventListener("click", () => shiftSelectedDay(-1));
  dateNextMonth.addEventListener("click", () => shiftSelectedDay(1));

  btnViewList.addEventListener("click", () => {
    setViewMode("list");
    render();
  });

  btnViewCalendar.addEventListener("click", () => {
    setViewMode("calendar");
    render();
  });

  calPrev.addEventListener("click", () => {
    if (calMonth === 0) {
      calMonth = 11;
      calYear -= 1;
    } else {
      calMonth -= 1;
    }
    render();
  });

  calNext.addEventListener("click", () => {
    if (calMonth === 11) {
      calMonth = 0;
      calYear += 1;
    } else {
      calMonth += 1;
    }
    render();
  });

  btnAddTodo.addEventListener("click", openAddModal);

  addCancel.addEventListener("click", () => closeModal(addModalBackdrop, addModal));
  addModalBackdrop.addEventListener("click", () => closeModal(addModalBackdrop, addModal));

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const imp = addForm.querySelector('input[name="importance"]:checked');
    const important = imp && imp.value === "important";
    const item = {
      id: uid(),
      title: addTitle.value.trim(),
      detail: addDetail.value.trim(),
      date: addDate.value,
      important,
      completed: false,
      createdAt: Date.now(),
    };
    if (!item.title) return;
    todos.push(item);
    closeModal(addModalBackdrop, addModal);
    render();
  });

  detailClose.addEventListener("click", () => {
    selectedId = null;
    closeModal(detailModalBackdrop, detailModal);
  });
  detailModalBackdrop.addEventListener("click", () => {
    selectedId = null;
    closeModal(detailModalBackdrop, detailModal);
  });

  detailEdit.addEventListener("click", () => {
    if (!selectedId) return;
    showDetailEdit();
    editTitle.focus();
  });

  detailMarkDone.addEventListener("click", () => {
    const todo = todos.find((x) => x.id === selectedId);
    if (todo && !todo.completed) {
      todo.completed = true;
      render();
      openDetailModal(selectedId);
    }
  });

  detailMarkUndone.addEventListener("click", () => {
    const todo = todos.find((x) => x.id === selectedId);
    if (todo && todo.completed) {
      todo.completed = false;
      render();
      openDetailModal(selectedId);
    }
  });

  detailEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const todo = todos.find((x) => x.id === selectedId);
    if (!todo) return;
    todo.title = editTitle.value.trim();
    todo.detail = editDetail.value.trim();
    todo.date = editDate.value;
    const imp = detailEditForm.querySelector('input[name="editImportance"]:checked');
    todo.important = Boolean(imp && imp.value === "important");
    if (!todo.title) return;
    render();
    showDetailView();
    detailViewTitle.textContent = todo.title;
    detailViewBody.textContent = todo.detail || "(내용 없음)";
    detailViewDate.textContent = formatDisplayDate(todo.date);
    detailViewImportance.textContent = isImportant(todo) ? "중요" : "일반";
    detailMarkDone.disabled = todo.completed;
    detailMarkUndone.disabled = !todo.completed;
  });

  editCancel.addEventListener("click", () => {
    if (!selectedId) return;
    const todo = todos.find((x) => x.id === selectedId);
    if (todo) {
      editTitle.value = todo.title;
      editDetail.value = todo.detail || "";
      editDate.value = todo.date;
      setEditImportanceRadios(isImportant(todo));
    }
    showDetailView();
  });

  deleteNo.addEventListener("click", closeDeleteConfirm);
  deleteModalBackdrop.addEventListener("click", closeDeleteConfirm);

  deleteYes.addEventListener("click", () => {
    const id = deleteTargetId;
    if (id) {
      todos = todos.filter((x) => x.id !== id);
      render();
      if (selectedId === id) {
        closeModal(detailModalBackdrop, detailModal);
        selectedId = null;
      }
    }
    closeDeleteConfirm();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!addModal.hidden) closeModal(addModalBackdrop, addModal);
    else if (!detailModal.hidden) {
      if (!detailEditForm.hidden) {
        editCancel.click();
      } else {
        detailClose.click();
      }
    } else if (!deleteModal.hidden) closeDeleteConfirm();
  });

  syncListDatePickerFromState();
  setViewMode("list");
  render();
})();
