const API_URL = import.meta.env.VITE_API_URL || "https://document-signature-app-production.up.railway.app/api";

const getToken = () => localStorage.getItem("signflow_token");

export const setAuthToken = (token: string | null) => {
  if (token) localStorage.setItem("signflow_token", token);
  else localStorage.removeItem("signflow_token");
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    return (await res.blob()) as T;
  }
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return {} as T;
}

export const api = {
  register: (data: { name: string; email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) }
    ),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(data) }
    ),

  getDraft: () => request<Record<string, unknown>>("/drafts"),
  saveDraft: (data: Record<string, unknown>) =>
    request("/drafts", { method: "PUT", body: JSON.stringify(data) }),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string; originalName: string; fileSize: number; status: string }>(
      "/docs/upload",
      { method: "POST", body: form }
    );
  },

  listDocuments: () =>
    request<Array<{ _id: string; originalName: string; status: string; createdAt: string; fileSize: number }>>(
      "/docs"
    ),

  getDocumentFile: (id: string) => request<Blob>(`/docs/${id}/file`),

  saveSignature: (data: Record<string, unknown>) =>
    request("/signatures", { method: "POST", body: JSON.stringify(data) }),

  getSignatures: (documentId: string) =>
    request<Array<Record<string, unknown>>>(`/signatures/document/${documentId}`),

  getRecipients: (documentId: string) =>
    request<Array<{ _id: string; name: string; email: string; role: string; status: string }>>(
      `/recipients/document/${documentId}`
    ),

  addRecipient: (data: { documentId: string; name: string; email: string; role: string }) =>
    request<{ _id: string; name: string; email: string; role: string; status: string }>(
      "/recipients",
      { method: "POST", body: JSON.stringify(data) }
    ),

  deleteRecipient: (id: string) =>
    request(`/recipients/${id}`, { method: "DELETE" }),

  sendReminder: (id: string) =>
    request<{ message: string; signLink: string }>(`/recipients/${id}/remind`, {
      method: "POST",
    }),

  getPublicSigningLink: (token: string) =>
    request<{
      recipient: {
        name: string;
        email: string;
        role: string;
        status: string;
        rejectionReason?: string;
      };
      document: { id: string; originalName: string; status: string };
    }>(`/recipients/public/${token}`),

  submitPublicSigningStatus: (token: string, data: { status: "Signed" | "Rejected"; rejectionReason?: string }) =>
    request<{ message: string }>(`/recipients/public/${token}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateSignedPdf: (documentId: string) =>
    request<Blob>(`/export/${documentId}/generate`, { method: "POST" }),

  getAuditTrail: (fileId: string) =>
    request<Array<{ action: string; details: string; createdAt: string; user?: { name: string } }>>(
      `/audit/${fileId}`
    ),
};
