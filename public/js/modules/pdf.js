import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";

export const PDFModule = {
  currentPdf: null,

  init: () => {
    // Init PDF.js worker
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  },

  handleUpload: async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Utils.showLoader("Uploading PDF...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await API.upload("/workspace/upload", formData);
      Utils.showToast("PDF uploaded successfully!", "success");
      PDFModule.loadFiles(); // Refresh list
      PDFModule.showPdfDashboard({
        _id: response.data.nodeId,
        meta: { originalName: response.data.fileName },
      });

      // Show processing progress
      const progressContainer = document.getElementById(
        "pdfProcessingProgress",
      );
      if (progressContainer) progressContainer.style.display = "block";
    } catch (error) {
      Utils.showToast(error.message || "Failed to upload PDF", "error");
    } finally {
      Utils.hideLoader();
    }
  },

  loadFiles: async () => {
    try {
      const response = await API.get("/workspace/files");
      AppState.pdfs = response.data.files;
      if (AppState.pdfs.length > 0) {
        // Optionally show the first PDF in the dashboard
        // PDFModule.showPdfDashboard(AppState.pdfs[0]);
      } else {
        document.getElementById("pdfEmptyState").style.display = "flex";
        document.getElementById("pdfDashboard").style.display = "none";
      }
    } catch (error) {
      console.error("Failed to load PDFs:", error);
      Utils.showToast("Failed to load PDFs", "error");
    }
  },

  showPdfDashboard: async (pdf) => {
    document.getElementById("pdfEmptyState").style.display = "none";
    document.getElementById("pdfDashboard").style.display = "grid";

    document.getElementById("pdfFileName").textContent = pdf.meta.originalName;
    document.getElementById("pageTitle").textContent = pdf.meta.originalName; // Update header

    PDFModule.currentPdf = pdf;

    // Fetch latest status
    const statusResponse = await API.get(`/workspace/files/${pdf._id}/status`);
    const status = statusResponse.data.status;
    const pageCount = statusResponse.data.pageCount || 0;

    const processingProgress = document.getElementById("pdfProcessingProgress");
    const progressBar = document.getElementById("pdfProgressBar");
    const progressText = document.getElementById("pdfProgressText");

    if (status === "QUEUED" || status === "PROCESSING") {
      if (processingProgress) processingProgress.style.display = "block";
      if (progressText)
        progressText.textContent = `${statusResponse.data.progress || 0}%`;
      if (progressBar)
        progressBar.style.width = `${statusResponse.data.progress || 0}%`;
    } else {
      if (processingProgress) processingProgress.style.display = "none";
    }

    document.getElementById("pdfPageCount").textContent = `${pageCount} Pages`;
    // Further updates for persona, summary etc. will be polled from the server
  },

  launchTool: (toolName) => {
    Utils.showToast(
      `Launching ${toolName} for ${PDFModule.currentPdf.meta.originalName}`,
      "info",
    );
    // Logic to navigate to AI tutor with specific tool context
  },
};
