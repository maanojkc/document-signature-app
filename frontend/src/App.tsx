import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, rgb } from "pdf-lib";

import {
  FileText,
  PenTool,
  Users,
  Settings,
  Upload,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  CheckCircle,
  Save,
  Check,
  Calendar,
  ChevronRight,
  Info,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Helper: Hex color to rgb value between 0 and 1
const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

// Helper: Base64 image to Uint8Array for pdf-lib embedding
const base64ToUint8Array = (base64: string) => {
  const base64Data = base64.split(",")[1];
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// --- Subcomponent: Drawing Pad for Signature Tab ---
interface DrawingPadProps {
  onSave: (dataUrl: string) => void;
  color: string;
}

const DrawingPad = ({ onSave, color }: DrawingPadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    setIsDrawing(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={350}
        height={180}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawingTouch}
        onTouchMove={drawTouch}
        onTouchEnd={stopDrawing}
        className="w-full border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-crosshair touch-none shadow-inner"
      />
      <div className="flex gap-2">
        <button
          onClick={clearCanvas}
          type="button"
          className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 font-medium transition"
        >
          Clear Pad
        </button>
        <button
          onClick={saveSignature}
          type="button"
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium shadow-md transition"
        >
          Insert Drawn Signature
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---
function App() {
  const [activeTab, setActiveTab] = useState<"documents" | "signatures" | "recipients" | "settings">("documents");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Document states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState("No Document");
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  // Signature configurations
  const [signatureType, setSignatureType] = useState<"text" | "drawn">("text");
  const [signatureText, setSignatureText] = useState("Manoj KC");
  const [fontFamily, setFontFamily] = useState("'Great Vibes', cursive");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#000000");
  const [drawnSignatureUrl, setDrawnSignatureUrl] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);

  // Position and sizes for overlays
  const [position, setPosition] = useState({ x: 200, y: 200 });
  const [size, setSize] = useState({ width: 300, height: 100 });

  // Date configurations
  const [showDate, setShowDate] = useState(false);
  const [dateText, setDateText] = useState(new Date().toLocaleDateString());
  const [datePosition, setDatePosition] = useState({ x: 200, y: 350 });
  const [dateSize, setDateSize] = useState({ width: 220, height: 60 });

  // Recipients State
  const [recipients, setRecipients] = useState([
    { id: 1, name: "Manoj KC", email: "manoj@example.com", role: "Signer", status: "Signed" },
    { id: 2, name: "John Doe", email: "john@example.com", role: "Approver", status: "Pending" },
  ]);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientRole, setNewRecipientRole] = useState("Signer");

  // Load Saved Draft on initial mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("signflow_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setSignatureText(parsed.signatureText || "Manoj KC");
        setFontFamily(parsed.fontFamily || "'Great Vibes', cursive");
        setFontSize(parsed.fontSize || 48);
        setColor(parsed.color || "#000000");
        setShowSignature(parsed.showSignature || false);
        setShowDate(parsed.showDate || false);
        setDateText(parsed.dateText || new Date().toLocaleDateString());
        setPosition(parsed.position || { x: 200, y: 200 });
        setSize(parsed.size || { width: 300, height: 100 });
        setDatePosition(parsed.datePosition || { x: 200, y: 350 });
        setDateSize(parsed.dateSize || { width: 220, height: 60 });
        setSignatureType(parsed.signatureType || "text");
        setDrawnSignatureUrl(parsed.drawnSignatureUrl || null);
        showToast("Restored last saved draft.");
      } catch (e) {
        console.error("Error loading draft", e);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSaveDraft = () => {
    const draftData = {
      signatureText,
      fontFamily,
      fontSize,
      color,
      showSignature,
      showDate,
      dateText,
      position,
      size,
      datePosition,
      dateSize,
      signatureType,
      drawnSignatureUrl,
    };
    localStorage.setItem("signflow_draft", JSON.stringify(draftData));
    showToast("Draft saved successfully to local storage!");
  };

  // Drag handles for Signature
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = position.x;
    const initialY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = initialX + deltaX;
      let newY = initialY + deltaY;

      newX = Math.max(0, Math.min(850 * zoom - size.width, newX));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = size.width;
    const initialHeight = size.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(80, initialWidth + deltaX);
      const newHeight = Math.max(40, initialHeight + deltaY);

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Drag handles for Date
  const handleDateDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = datePosition.x;
    const initialY = datePosition.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = initialX + deltaX;
      let newY = initialY + deltaY;

      newX = Math.max(0, Math.min(850 * zoom - dateSize.width, newX));
      setDatePosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDateResizeStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = dateSize.width;
    const initialHeight = dateSize.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(80, initialWidth + deltaX);
      const newHeight = Math.max(30, initialHeight + deltaY);

      setDateSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const downloadSignedPDF = async () => {
    if (!pdfFile) return;

    try {
      showToast("Generating signed document...");
      const existingPdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // --- Draw Signature Overlay ---
      if (showSignature) {
        let remainingY = position.y;
        let targetPage = pages[0];

        // Find correct PDF page relative to vertical viewport scrolling height
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();
          const scale = (850 * zoom) / pdfPageWidth;
          const screenPageHeight = pdfPageHeight * scale;

          if (remainingY < screenPageHeight) {
            targetPage = page;
            break;
          }
          remainingY -= screenPageHeight;
        }

        const { width: pdfPageWidth, height: pdfPageHeight } = targetPage.getSize();
        const scale = pdfPageWidth / (850 * zoom);

        if (signatureType === "text") {
          targetPage.drawText(signatureText, {
            x: position.x * scale,
            y: pdfPageHeight - (remainingY * scale) - (size.height * scale),
            size: fontSize * scale,
            color: hexToRgb(color),
          });
        } else if (signatureType === "drawn" && drawnSignatureUrl) {
          const imageBytes = base64ToUint8Array(drawnSignatureUrl);
          const pngImage = await pdfDoc.embedPng(imageBytes);
          targetPage.drawImage(pngImage, {
            x: position.x * scale,
            y: pdfPageHeight - (remainingY * scale) - (size.height * scale),
            width: size.width * scale,
            height: size.height * scale,
          });
        }
      }

      // --- Draw Date Overlay ---
      if (showDate) {
        let remainingDateY = datePosition.y;
        let targetDatePage = pages[0];

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();
          const scale = (850 * zoom) / pdfPageWidth;
          const screenPageHeight = pdfPageHeight * scale;

          if (remainingDateY < screenPageHeight) {
            targetDatePage = page;
            break;
          }
          remainingDateY -= screenPageHeight;
        }

        const { width: pdfPageWidth, height: pdfPageHeight } = targetDatePage.getSize();
        const scale = pdfPageWidth / (850 * zoom);

        targetDatePage.drawText(dateText, {
          x: datePosition.x * scale,
          y: pdfPageHeight - (remainingDateY * scale) - (dateSize.height * scale),
          size: fontSize * 0.8 * scale, // slightly smaller date font
          color: hexToRgb(color),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `signed-${pdfFileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("Document downloaded successfully!");
    } catch (error) {
      console.error(error);
      showToast("Failed to compile and sign PDF.");
    }
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientName || !newRecipientEmail) return;
    const newRecipient = {
      id: Date.now(),
      name: newRecipientName,
      email: newRecipientEmail,
      role: newRecipientRole,
      status: "Pending",
    };
    setRecipients([...recipients, newRecipient]);
    setNewRecipientName("");
    setNewRecipientEmail("");
    showToast(`Recipient "${newRecipient.name}" added successfully.`);
  };

  const handleDeleteRecipient = (id: number) => {
    setRecipients(recipients.filter((r) => r.id !== id));
    showToast("Recipient removed.");
  };

  const handleSendReminder = (name: string) => {
    showToast(`Signing reminder email sent to ${name}!`);
  };

  return (
    <div className="h-screen flex bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-[999999] flex items-center gap-2 border border-slate-700 animate-slide-in">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* --- Sidebar --- */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shadow-2xl border-r border-slate-800 flex-shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md text-lg">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">SignFlow</h1>
              <p className="text-xs text-slate-400">E-Signature Suite</p>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("documents")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left text-sm font-medium ${
                activeTab === "documents"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <FileText size={18} />
              Document Editor
            </button>

            <button
              onClick={() => setActiveTab("signatures")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left text-sm font-medium ${
                activeTab === "signatures"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <PenTool size={18} />
              Saved Signatures
            </button>

            <button
              onClick={() => setActiveTab("recipients")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left text-sm font-medium ${
                activeTab === "recipients"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Users size={18} />
              Recipients
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left text-sm font-medium ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Settings size={18} />
              App Settings
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 bg-slate-850 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs">
              MK
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Manoj KC</p>
              <p className="text-[10px] text-slate-400">Professional Plan</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase bg-slate-100 px-2.5 py-1 rounded">
              Active File
            </span>
            <h2 className="font-semibold text-slate-800 text-base max-w-sm truncate">
              {pdfFileName}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <Save size={16} />
              Save Draft
            </button>

            <button
              onClick={downloadSignedPDF}
              disabled={!pdfFile}
              className={`px-5 py-2 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2 ${
                pdfFile ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10" : "bg-slate-350 cursor-not-allowed shadow-none"
              }`}
            >
              <Check size={16} />
              Download Signed PDF
            </button>
          </div>
        </header>

        {/* --- Render Tab Contents --- */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* TAB 1: DOCUMENT EDITOR */}
          {activeTab === "documents" && (
            <>
              {/* PDF Renderer */}
              <div className="flex-1 p-6 overflow-auto bg-slate-100 flex flex-col items-center">
                <div className="w-full max-w-5xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col flex-1">
                  
                  {/* PDF Viewer Control Bar */}
                  <div className="h-14 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
                        disabled={!pdfFile}
                        className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:text-slate-800 text-slate-600 transition disabled:opacity-50"
                        title="Zoom Out"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <span className="text-xs font-semibold px-2.5 text-slate-600">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        onClick={() => setZoom((prev) => Math.min(1.8, prev + 0.15))}
                        disabled={!pdfFile}
                        className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:text-slate-800 text-slate-600 transition disabled:opacity-50"
                        title="Zoom In"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>

                    <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 text-xs font-semibold shadow transition">
                      <Upload size={14} />
                      Upload PDF
                      <input
                        hidden
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setPdfFile(e.target.files[0]);
                            setPdfFileName(e.target.files[0].name);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* PDF Canvas Viewport Container */}
                  <div className="flex-1 p-6 overflow-auto bg-slate-500/10 flex justify-center items-start min-h-[500px]">
                    {pdfFile ? (
                      <div
                        className="relative border border-slate-350 shadow-2xl bg-white select-none transition-all duration-100"
                        style={{ width: `${850 * zoom}px` }}
                      >
                        <Document
                          file={pdfFile}
                          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        >
                          {Array.from(new Array(numPages), (_, index) => (
                            <Page
                              key={index}
                              pageNumber={index + 1}
                              width={850 * zoom}
                              renderAnnotationLayer={false}
                              renderTextLayer={false}
                            />
                          ))}
                        </Document>

                        {/* Draggable Signature Overlay */}
                        {showSignature && (
                          <div
                            onMouseDown={handleDragStart}
                            style={{
                              position: "absolute",
                              left: `${position.x}px`,
                              top: `${position.y}px`,
                              width: `${size.width}px`,
                              height: `${size.height}px`,
                              zIndex: 99999,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "move",
                              userSelect: "none",
                              backgroundColor: "rgba(255, 255, 255, 0.75)",
                              border: "2px dashed #2563eb",
                              borderRadius: "8px",
                              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
                            }}
                          >
                            {signatureType === "text" ? (
                              <span
                                style={{
                                  fontFamily,
                                  fontSize: `${fontSize * zoom}px`,
                                  color,
                                  whiteSpace: "nowrap",
                                  lineHeight: 1,
                                }}
                              >
                                {signatureText}
                              </span>
                            ) : drawnSignatureUrl ? (
                              <img
                                src={drawnSignatureUrl}
                                alt="Signature"
                                style={{
                                  width: "90%",
                                  height: "90%",
                                  objectFit: "contain",
                                  pointerEvents: "none",
                                }}
                              />
                            ) : (
                              <span className="text-slate-400 text-xs font-semibold">Draw signature first</span>
                            )}

                            {/* Custom Circular Resize Handle */}
                            <div
                              onMouseDown={handleResizeStart}
                              style={{
                                position: "absolute",
                                bottom: "-6px",
                                right: "-6px",
                                width: "12px",
                                height: "12px",
                                backgroundColor: "#2563eb",
                                border: "2px solid #ffffff",
                                borderRadius: "50%",
                                cursor: "se-resize",
                                zIndex: 100000,
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              }}
                            />
                          </div>
                        )}

                        {/* Draggable Date Overlay */}
                        {showDate && (
                          <div
                            onMouseDown={handleDateDragStart}
                            style={{
                              position: "absolute",
                              left: `${datePosition.x}px`,
                              top: `${datePosition.y}px`,
                              width: `${dateSize.width}px`,
                              height: `${dateSize.height}px`,
                              zIndex: 99999,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "move",
                              userSelect: "none",
                              backgroundColor: "rgba(255, 255, 255, 0.75)",
                              border: "2px dashed #b91c1c",
                              borderRadius: "8px",
                              boxShadow: "0 4px 12px rgba(185, 28, 28, 0.15)",
                            }}
                          >
                            <span
                              style={{
                                fontFamily,
                                fontSize: `${fontSize * 0.8 * zoom}px`,
                                color,
                                whiteSpace: "nowrap",
                                lineHeight: 1,
                              }}
                            >
                              {dateText}
                            </span>

                            {/* Circular Date Resize Handle */}
                            <div
                              onMouseDown={handleDateResizeStart}
                              style={{
                                position: "absolute",
                                bottom: "-6px",
                                right: "-6px",
                                width: "12px",
                                height: "12px",
                                backgroundColor: "#b91c1c",
                                border: "2px solid #ffffff",
                                borderRadius: "50%",
                                cursor: "se-resize",
                                zIndex: 100000,
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-[600px] border-3 border-dashed border-slate-350 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-white p-8 max-w-xl self-center shadow-md">
                        <Upload size={48} className="text-slate-400 mb-4 animate-pulse" />
                        <h3 className="font-bold text-slate-700 text-lg mb-1">Upload your document</h3>
                        <p className="text-sm text-slate-400 text-center mb-5 max-w-xs">
                          Drag and drop your PDF here, or click upload to start placing signature and date stamps.
                        </p>
                        <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow shadow-blue-500/20 cursor-pointer transition">
                          Browse Files
                          <input
                            hidden
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setPdfFile(e.target.files[0]);
                                setPdfFileName(e.target.files[0].name);
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Tools Panel */}
              <div className="w-96 bg-white border-l border-slate-200 p-6 overflow-auto flex flex-col justify-between flex-shrink-0">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">Signature Controls</h3>
                    <p className="text-xs text-slate-400">Configure parameters for placing on the document.</p>
                  </div>

                  {/* Choose Signature Type */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Input Type
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                      <button
                        onClick={() => setSignatureType("text")}
                        className={`py-1.5 text-xs font-semibold rounded-md transition ${
                          signatureType === "text"
                            ? "bg-white text-slate-800 shadow"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Type Text
                      </button>
                      <button
                        onClick={() => setSignatureType("drawn")}
                        className={`py-1.5 text-xs font-semibold rounded-md transition ${
                          signatureType === "drawn"
                            ? "bg-white text-slate-800 shadow"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Draw Canvas
                      </button>
                    </div>
                  </div>

                  {signatureType === "text" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Signer Name
                        </label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Font Style
                        </label>
                        <select
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white"
                        >
                          <option value="'Great Vibes', cursive">Great Vibes (Script)</option>
                          <option value="'Pacifico', cursive">Pacifico (Modern Script)</option>
                          <option value="'Dancing Script', cursive">Dancing Script (Classic)</option>
                          <option value="serif">Serif (Traditional)</option>
                          <option value="monospace">Monospace (Clean)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Draw Signature
                      </label>
                      <DrawingPad
                        color={color}
                        onSave={(url) => {
                          setDrawnSignatureUrl(url);
                          showToast("Signature drawing captured!");
                        }}
                      />
                    </div>
                  )}

                  {/* Color Preset Palette */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Stamp Ink Color
                    </label>
                    <div className="flex gap-2.5 items-center">
                      {[
                        { hex: "#000000", label: "Black" },
                        { hex: "#1e40af", label: "Navy Blue" },
                        { hex: "#b91c1c", label: "Red" },
                        { hex: "#15803d", label: "Green" },
                      ].map((preset) => (
                        <button
                          key={preset.hex}
                          onClick={() => setColor(preset.hex)}
                          className={`w-7 h-7 rounded-full border-2 transition ${
                            color === preset.hex
                              ? "border-slate-800 scale-110 shadow-md shadow-slate-900/10"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.label}
                        />
                      ))}
                      
                      <div className="relative w-8 h-8 rounded-full border-2 border-slate-200 overflow-hidden hover:scale-105 transition">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0"
                          title="Custom Color"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Font Size Range Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Font / Stamp Size
                      </label>
                      <span className="text-xs font-bold text-slate-600">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-ew-resize h-1 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Include Date Stamp Toggle */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Include Date Stamp
                      </label>
                      <input
                        type="checkbox"
                        checked={showDate}
                        onChange={(e) => setShowDate(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition cursor-pointer"
                      />
                    </div>

                    {showDate && (
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-slate-500">
                          Date Field Value
                        </label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-3 text-slate-400" />
                          <input
                            type="text"
                            value={dateText}
                            onChange={(e) => setDateText(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg pl-9 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stamp Preview */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-inner">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                      Live Stamp Preview
                    </p>
                    <div
                      style={{
                        minHeight: "80px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {signatureType === "text" ? (
                        <div
                          style={{
                            fontFamily,
                            fontSize: `${fontSize * 0.75}px`,
                            color,
                            lineHeight: 1,
                            textAlign: "center",
                          }}
                        >
                          {signatureText}
                        </div>
                      ) : drawnSignatureUrl ? (
                        <img
                          src={drawnSignatureUrl}
                          alt="Signature Preview"
                          className="max-h-16 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic font-medium">Draw signature to preview</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => {
                      setPosition({ x: 200, y: 200 });
                      setSize({ width: 300, height: 100 });
                      setShowSignature(true);
                      showToast("Signature stamp spawned on PDF.");
                    }}
                    disabled={!pdfFile}
                    className={`w-full py-3 text-white rounded-lg text-sm font-semibold shadow-md transition ${
                      pdfFile ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10 cursor-pointer" : "bg-slate-350 cursor-not-allowed shadow-none"
                    }`}
                  >
                    Add Signature Overlay
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SAVED SIGNATURES TAB */}
          {activeTab === "signatures" && (
            <div className="flex-1 p-8 overflow-auto bg-slate-50">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Saved Signatures</h3>
                  <p className="text-sm text-slate-500">Configure or paint digital signatures stored locally.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left block: canvas paint */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <PenTool size={16} className="text-blue-500" />
                      Create Signature Stamp
                    </h4>
                    <p className="text-xs text-slate-400">
                      Use your mouse, trackpad, or touch screen to draw a custom signature stamp.
                    </p>
                    <DrawingPad
                      color={color}
                      onSave={(url) => {
                        setDrawnSignatureUrl(url);
                        setSignatureType("drawn");
                        setActiveTab("documents");
                        setShowSignature(true);
                        showToast("Signature loaded to Document Editor.");
                      }}
                    />
                  </div>

                  {/* Right block: Font selection generator */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      Text Signature Generator
                    </h4>
                    <p className="text-xs text-slate-400">
                      Generate high-fidelity cursive and script type signatures immediately.
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Signature Name
                        </label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Select Font Style
                        </label>
                        {[
                          { val: "'Great Vibes', cursive", name: "Great Vibes style" },
                          { val: "'Pacifico', cursive", name: "Pacifico Modern style" },
                          { val: "'Dancing Script', cursive", name: "Dancing Script Traditional" },
                        ].map((f) => (
                          <button
                            key={f.val}
                            onClick={() => {
                              setFontFamily(f.val);
                              setSignatureType("text");
                              setActiveTab("documents");
                              setShowSignature(true);
                              showToast(`Applied ${f.name}`);
                            }}
                            className={`w-full p-4 border rounded-xl flex items-center justify-between hover:bg-slate-50 transition text-left ${
                              fontFamily === f.val ? "border-blue-500 bg-blue-50/20" : "border-slate-200"
                            }`}
                          >
                            <span style={{ fontFamily: f.val, fontSize: "24px", color }}>
                              {signatureText}
                            </span>
                            <ChevronRight size={16} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECIPIENTS MANAGEMENT */}
          {activeTab === "recipients" && (
            <div className="flex-1 p-8 overflow-auto bg-slate-50">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Recipients & Signers</h3>
                  <p className="text-sm text-slate-500">Configure signer lists and monitor signature completion status.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Block: Add Form */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Plus size={16} className="text-blue-500" />
                      Add Signer
                    </h4>
                    
                    <form onSubmit={handleAddRecipient} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newRecipientName}
                          onChange={(e) => setNewRecipientName(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                          placeholder="e.g. Jane Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={newRecipientEmail}
                          onChange={(e) => setNewRecipientEmail(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                          placeholder="e.g. jane@company.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Signing Role
                        </label>
                        <select
                          value={newRecipientRole}
                          onChange={(e) => setNewRecipientRole(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white"
                        >
                          <option value="Signer">Signer (Signs document)</option>
                          <option value="Approver">Approver (Approves details)</option>
                          <option value="Viewer">Viewer (Read-only copy)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow hover:bg-blue-700 transition"
                      >
                        Add to List
                      </button>
                    </form>
                  </div>

                  {/* Right Block: Signers Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden md:col-span-2">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                      <h4 className="font-semibold text-slate-700 text-sm">Active Signers Table</h4>
                    </div>

                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase bg-slate-50/50">
                          <th className="p-4">Name</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipients.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-4">
                              <p className="font-semibold text-slate-800">{r.name}</p>
                              <p className="text-xs text-slate-400">{r.email}</p>
                            </td>
                            <td className="p-4">
                              <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                                {r.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  r.status === "Signed"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-amber-50 text-amber-600"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2.5 justify-end">
                                <button
                                  onClick={() => handleSendReminder(r.name)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition"
                                >
                                  Remind
                                </button>
                                <button
                                  onClick={() => handleDeleteRecipient(r.id)}
                                  className="text-slate-400 hover:text-red-600 transition"
                                  title="Delete Signer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: APP SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="flex-1 p-8 overflow-auto bg-slate-50">
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">App Settings</h3>
                  <p className="text-sm text-slate-500">Configure global settings, default configurations, and layout properties.</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                  {/* General Configuration */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700 text-sm border-b pb-2">Signing Preferences</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Default Signer Name
                        </label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Document Layout Scale
                        </label>
                        <select
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white"
                        >
                          <option value="0.7">Small Viewport (70%)</option>
                          <option value="1.0">Medium Viewport (100%)</option>
                          <option value="1.3">Large Viewport (130%)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Date Config */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700 text-sm border-b pb-2">System Defaults</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Default Ink Color
                        </label>
                        <select
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition bg-white"
                        >
                          <option value="#000000">Black</option>
                          <option value="#1e40af">Navy Blue</option>
                          <option value="#b91c1c">Red</option>
                          <option value="#15803d">Green</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Default Date Format
                        </label>
                        <input
                          type="text"
                          value={dateText}
                          onChange={(e) => setDateText(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-blue-700 leading-normal">
                    <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Local Session Storage Info:</span> Draft configurations, signature drawings, colors, and fonts are automatically cached inside the browser session namespace (`signflow_draft`). Saving changes will commit these configurations as default values.
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        handleSaveDraft();
                        showToast("Global configurations saved successfully.");
                      }}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow hover:bg-blue-700 transition"
                    >
                      Save Configuration Defaults
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;