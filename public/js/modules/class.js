import { AppState } from "./state.js";
import { Utils } from "./ui.js";
import { API } from "./api.js";

export const ClassModule = {
  init: async () => {
    try {
      const response = await API.get("/classes");
      if (response && response.data) {
        AppState.classes = response.data.classes || [];
      }
      ClassModule.renderClassList();
    } catch (error) {
      console.error("Failed to load classes:", error);
      AppState.classes = Utils.loadFromStorage("scholar_classes", []);
      ClassModule.renderClassList();
    }

    document.querySelectorAll(".color-dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        document
          .querySelectorAll(".color-dot")
          .forEach((d) => d.classList.remove("selected"));
        e.target.classList.add("selected");
      });
    });
  },

  renderClassList: () => {
    const container = document.getElementById("classListContainer");
    container.innerHTML = "";

    AppState.classes.forEach((cls) => {
      const link = document.createElement("a");
      link.href = "#";
      link.className = "nav-link animate__animated animate__fadeInLeft";
      link.innerHTML = `
                <i class="fas fa-book"></i>
                <span>${cls.name}</span>
            `;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        ClassModule.openClass(cls.id);
      });
      container.appendChild(link);
    });
  },

  openModal: () => {
    document.getElementById("createClassModal").style.display = "flex";
    document.getElementById("classNameInput").focus();
  },

  closeModal: () => {
    document.getElementById("createClassModal").style.display = "none";
    document.getElementById("classNameInput").value = "";
    document.getElementById("classDescInput").value = "";
  },

  createClass: async () => {
    const name = document.getElementById("classNameInput").value.trim();
    const desc = document.getElementById("classDescInput").value.trim();
    const selectedColor = document.querySelector(".color-dot.selected");

    if (!name) {
      Utils.showToast("Please enter a class name", "error");
      return;
    }

    try {
      const response = await API.post("/classes", {
        name,
        description: desc || "",
        color: selectedColor?.getAttribute("data-color") || "green",
      });

      AppState.classes.push(response.data);
      ClassModule.renderClassList();
      ClassModule.closeModal();

      Utils.showToast(`Class "${name}" created successfully!`, "success");

      setTimeout(() => ClassModule.openClass(response.data._id), 500);
    } catch (error) {
      Utils.showToast(error.message || "Failed to create class", "error");
    }
  },

  openClass: (classId) => {
    const cls = AppState.classes.find((c) => c.id === classId);
    if (!cls) return;

    AppState.activeClassId = classId;

    document
      .querySelectorAll(".view")
      .forEach((v) => (v.style.display = "none"));

    const template = document.getElementById("view-class-template");
    template.style.display = "block";

    document.getElementById("classTitle").textContent = cls.name;
    document.getElementById("classDescription").textContent = cls.description;
    document.getElementById("pageTitle").textContent = cls.name;

    document
      .querySelectorAll(".nav-link")
      .forEach((l) => l.classList.remove("active"));
  },
};
