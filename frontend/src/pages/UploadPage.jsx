import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import apiService from "../services/apiService";

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [recentUploads, setRecentUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  // we load recent uploads on mount
  useEffect(() => {
    loadRecentUploads();
  }, []);

  const loadRecentUploads = async () => {
    try {
      const response = await apiService.getDocuments({
        limit: 5,
        sortField: "created_at",
        sortOrder: "desc",
      });
      const data = response.data || response;
      setRecentUploads(data.documents || []);
    } catch (error) {
      console.error("Failed to load recent uploads:", error);
    }
  };

  // file validation
  const validateFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return `Nepodržan format: ${file.name}. Dozvoljeni su: PDF, JPG, PNG`;
    }

    if (file.size > maxSize) {
      return `Fajl je prevelik: ${file.name}. Maksimalna veličina je 10MB`;
    }

    return null;
  };

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          progress: 0,
          status: "waiting", // waiting, uploading, completed, failed
          error: null,
        });
      }
    });

    if (errors.length > 0) {
      errors.forEach((error) => showError(error));
    }

    if (validFiles.length > 0) {
      setUploadQueue((prev) => [...prev, ...validFiles]);
      showInfo(`Dodato ${validFiles.length} fajlova u red za upload`);
    }
  };

  // drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  // file input click handler
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
      e.target.value = ""; // Reset input
    }
  };

  // upload single file
  const uploadFile = async (fileItem) => {
    try {
      // Update status to uploading
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === fileItem.id
            ? { ...item, status: "uploading", progress: 0 }
            : item
        )
      );

      // Use apiService for upload instead of direct fetch
      const response = await apiService.uploadDocuments(fileItem.file);

      // apiService already handles JSON parsing and error handling
      const result = await response;

      //update status to completed
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === fileItem.id
            ? { ...item, status: "completed", progress: 100, result }
            : item
        )
      );

      setUploadStats((prev) => ({
        ...prev,
        completed: prev.completed + 1,
      }));

      return result;
    } catch (error) {
      console.error("Upload error:", error);

      // Update status to failed
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === fileItem.id
            ? { ...item, status: "failed", error: error.message }
            : item
        )
      );

      setUploadStats((prev) => ({
        ...prev,
        failed: prev.failed + 1,
      }));

      throw error;
    }
  };

  // start upload process
  const startUpload = async () => {
    const waitingFiles = uploadQueue.filter(
      (item) => item.status === "waiting"
    );

    if (waitingFiles.length === 0) {
      showWarning("Nema fajlova za upload");
      return;
    }

    setIsUploading(true);
    setUploadStats({
      total: waitingFiles.length,
      completed: 0,
      failed: 0,
    });

    showInfo(`Počinje upload ${waitingFiles.length} fajlova...`);

    // upload files sequentially to avoid overwhelming the server
    for (const fileItem of waitingFiles) {
      try {
        await uploadFile(fileItem);
      } catch (error) {}
    }

    setIsUploading(false);

    //show final results
    const finalStats = uploadStats;
    const completed = uploadQueue.filter(
      (item) => item.status === "completed"
    ).length;
    const failed = uploadQueue.filter(
      (item) => item.status === "failed"
    ).length;

    if (completed > 0) {
      showSuccess(`Uspešno uploadovano ${completed} dokumenata`);
    }
    if (failed > 0) {
      showError(`Neuspešno uploadovano ${failed} dokumenata`);
    }

    //refresh recent uploads
    loadRecentUploads();
  };

  const clearCompleted = () => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) => item.status !== "completed" && item.status !== "failed"
      )
    );
  };

  //remove file from queue
  const removeFile = (fileId) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== fileId));
  };

  const clearAll = () => {
    setUploadQueue([]);
    setUploadStats({ total: 0, completed: 0, failed: 0 });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "waiting":
        return (
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
        );
      case "uploading":
        return (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        );
      case "completed":
        return (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-2 h-2 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case "failed":
        return (
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-2 h-2 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Upload dokumenata
          </h1>
          <p className="text-gray-600">
            Otpremite nove fakture i dokumente za obradu
          </p>
        </div>
        <button
          onClick={() => navigate("/documents")}
          className="btn-secondary flex items-center space-x-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Vidi sve dokumente</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Upload Area */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Drag & Drop Upload
            </h3>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleFileInputClick}
            >
              <div className="text-4xl text-gray-400 mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                Prevucite dokumente ovde
              </p>
              <p className="text-gray-500 mb-4">
                ili kliknite da izaberete fajlove
              </p>
              <button
                className="btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileInputClick();
                }}
              >
                Izaberite fajlove
              </button>
              <p className="text-xs text-gray-400 mt-4">
                Podržani formati: PDF, JPG, PNG (maksimalno 10MB)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Upload Queue */}
          {uploadQueue.length > 0 && (
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Upload red ({uploadQueue.length})
                  </h3>
                  <div className="flex space-x-2">
                    {!isUploading &&
                      uploadQueue.some((item) => item.status === "waiting") && (
                        <button
                          onClick={startUpload}
                          className="btn-primary text-sm"
                          disabled={isUploading}
                        >
                          Start Upload
                        </button>
                      )}
                    <button
                      onClick={clearCompleted}
                      className="btn-secondary text-sm"
                      disabled={isUploading}
                    >
                      Ukloni završene
                    </button>
                    <button
                      onClick={clearAll}
                      className="btn-secondary text-sm"
                      disabled={isUploading}
                    >
                      Obriši sve
                    </button>
                  </div>
                </div>

                {uploadStats.total > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Upload progres</span>
                      <span>
                        {uploadStats.completed + uploadStats.failed} /{" "}
                        {uploadStats.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            uploadStats.total > 0
                              ? ((uploadStats.completed + uploadStats.failed) /
                                  uploadStats.total) *
                                100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {uploadQueue.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="p-4 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getStatusIcon(fileItem.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {fileItem.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                          {fileItem.error && (
                            <p className="text-xs text-red-600 mt-1">
                              {fileItem.error}
                            </p>
                          )}
                        </div>
                      </div>

                      {fileItem.status === "waiting" && (
                        <button
                          onClick={() => removeFile(fileItem.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          disabled={isUploading}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {fileItem.status === "uploading" && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-blue-600 h-1 rounded-full animate-pulse"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Recent Uploads */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Nedavni upload-ovi
              </h3>
              <button
                onClick={loadRecentUploads}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Osvezi
              </button>
            </div>

            {recentUploads.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl text-gray-300 mb-4">📊</div>
                <p className="text-gray-500">Nema nedavnih upload-ova</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUploads.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-6 w-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.original_filename || doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        doc.document_status === "processed"
                          ? "text-green-700 bg-green-100"
                          : doc.document_status === "pending"
                          ? "text-yellow-700 bg-yellow-100"
                          : "text-red-700 bg-red-100"
                      }`}
                    >
                      {doc.document_status === "processed"
                        ? "Obrađen"
                        : doc.document_status === "pending"
                        ? "Čeka"
                        : "Greška"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Instructions */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Upload instrukcije
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Prihvaćeni formati: PDF, JPG, PNG</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Maksimalna veličina: 10MB po fajlu</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Možete upload-ovati više fajlova odjednom</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>AI sistem će automatski izvući podatke</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Upload progres se prati u realnom vremenu</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
