import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type CertType = "origin" | "client";

interface CertificateSummary {
  id: string;
  certType: CertType;
  ownerUserId: string | null;
  name: string;
  description: string | null;
  subject: string | null;
  issuer: string | null;
  serialNumber: string | null;
  fingerprintSha256: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  hasPrivateKey: boolean;
  hasChain: boolean;
  revokedAt: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
}

/**
 * Certificate management UI mounted below the deployments list. Admins
 * can upload origin OR client certs and see every row; operators can only
 * upload client certs and see only their own. Backend role-gating is the
 * source of truth — the UI hides the origin option for non-admins purely
 * to avoid confusing them.
 */
export default function CertificatesSection() {
  const { user, isAdmin } = useAuth();
  const admin = isAdmin();
  const [certs, setCerts] = useState<CertificateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const data = await api.get<{ certificates: CertificateSummary[] }>(
        "/infrastructure/certificates",
      );
      setCerts(data.certificates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load certificates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Buckets — admin sees both sections; operator only sees client.
  const { origin, client } = useMemo(() => {
    const o: CertificateSummary[] = [];
    const c: CertificateSummary[] = [];
    for (const cert of certs) {
      (cert.certType === "origin" ? o : c).push(cert);
    }
    return { origin: o, client: c };
  }, [certs]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete certificate "${name}"? This is permanent.`)) return;
    try {
      await api.delete(`/infrastructure/certificates/${id}`);
      toast.success(`Deleted ${name}`);
      refresh(true);
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Delete failed");
    }
  }

  async function handleActivate(id: string, name: string) {
    try {
      await api.post(`/infrastructure/certificates/${id}/activate`);
      toast.success(`Activated ${name}`);
      refresh(true);
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Activation failed");
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <h4 className="text-sm font-semibold text-foreground">Certificates</h4>
          <p className="text-xs text-muted-foreground ml-2">
            {admin
              ? "Origin (org-wide TLS terminator) and client (mTLS) certificates."
              : "Your client certificates (mTLS). Origin certificates are admin-managed."}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refresh(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      <UploadCard onUploaded={() => refresh(true)} canUploadOrigin={admin} />

      {loading ? (
        <div className="text-sm text-muted-foreground italic mt-4">Loading certificates…</div>
      ) : (
        <div className="mt-4 space-y-4">
          {admin && (
            <CertList
              title="Origin (TLS terminator)"
              emptyHint="No origin certificate uploaded yet."
              certs={origin}
              currentUserId={user?.id}
              admin={admin}
              onDelete={handleDelete}
              onActivate={handleActivate}
            />
          )}
          <CertList
            title={admin ? "Client (mTLS)" : "Your client certificates"}
            emptyHint={
              admin
                ? "No client certificates uploaded yet."
                : "You haven't uploaded any client certificates yet."
            }
            certs={client}
            currentUserId={user?.id}
            admin={admin}
            onDelete={handleDelete}
            onActivate={handleActivate}
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface UploadCardProps {
  onUploaded: () => void;
  canUploadOrigin: boolean;
}

function UploadCard({ onUploaded, canUploadOrigin }: UploadCardProps) {
  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const chainInputRef = useRef<HTMLInputElement>(null);

  const [certType, setCertType] = useState<CertType>(canUploadOrigin ? "origin" : "client");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [chainFile, setChainFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setCertFile(null);
    setKeyFile(null);
    setChainFile(null);
    if (certInputRef.current) certInputRef.current.value = "";
    if (keyInputRef.current) keyInputRef.current.value = "";
    if (chainInputRef.current) chainInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!certFile) {
      toast.error("Select a certificate file");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("certType", certType);
      fd.append("name", name.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("cert", certFile);
      if (keyFile) fd.append("key", keyFile);
      if (chainFile) fd.append("chain", chainFile);
      const res = await fetch("/api/v1/infrastructure/certificates", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Upload failed (HTTP ${res.status})`);
      }
      toast.success(`Uploaded ${name.trim()}`);
      reset();
      onUploaded();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border/60 rounded-md p-4 bg-muted/20 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block mb-1">
            Type
          </label>
          <select
            className="text-sm bg-background border border-border rounded px-2 py-1"
            value={certType}
            onChange={(e) => setCertType(e.target.value as CertType)}
          >
            {canUploadOrigin && <option value="origin">Origin (TLS terminator)</option>}
            <option value="client">Client (mTLS)</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block mb-1">
            Name
          </label>
          <input
            type="text"
            className="text-sm bg-background border border-border rounded px-2 py-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={certType === "origin" ? "Cloudflare Origin Cert" : "ops@example.com mTLS"}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            className="text-sm bg-background border border-border rounded px-2 py-1 w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes about this certificate"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FileInputRow
          label="Certificate (PEM)"
          required
          file={certFile}
          inputRef={certInputRef}
          onChange={setCertFile}
          accept=".pem,.crt,.cer"
        />
        <FileInputRow
          label="Private Key (PEM) — optional"
          file={keyFile}
          inputRef={keyInputRef}
          onChange={setKeyFile}
          accept=".pem,.key"
          hint="Encrypted at rest. Omit if RTPI only needs the public cert."
        />
        <FileInputRow
          label="Chain (PEM) — optional"
          file={chainFile}
          inputRef={chainInputRef}
          onChange={setChainFile}
          accept=".pem,.crt,.ca,.bundle"
          hint="Intermediates + root if needed."
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={uploading}>
          Clear
        </Button>
        <Button type="submit" size="sm" disabled={uploading}>
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Upload
        </Button>
      </div>
    </form>
  );
}

function FileInputRow({
  label,
  file,
  inputRef,
  onChange,
  required,
  accept,
  hint,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (f: File | null) => void;
  required?: boolean;
  accept: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="text-xs"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      {file && (
        <p className="text-[11px] text-foreground mt-1 truncate" title={file.name}>
          {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface CertListProps {
  title: string;
  emptyHint: string;
  certs: CertificateSummary[];
  currentUserId: string | undefined;
  admin: boolean;
  onDelete: (id: string, name: string) => void;
  onActivate: (id: string, name: string) => void;
}

function CertList({ title, emptyHint, certs, currentUserId, admin, onDelete, onActivate }: CertListProps) {
  return (
    <div>
      <h5 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
        {title} ({certs.length})
      </h5>
      {certs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {certs.map((cert) => (
            <CertRow
              key={cert.id}
              cert={cert}
              ownedByCurrent={cert.ownerUserId === currentUserId}
              admin={admin}
              onDelete={() => onDelete(cert.id, cert.name)}
              onActivate={() => onActivate(cert.id, cert.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CertRow({
  cert,
  ownedByCurrent,
  admin,
  onDelete,
  onActivate,
}: {
  cert: CertificateSummary;
  ownedByCurrent: boolean;
  admin: boolean;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const expiresMs = new Date(cert.validTo).getTime() - Date.now();
  const expiringSoon = expiresMs > 0 && expiresMs < 30 * 24 * 60 * 60 * 1000;
  const expired = expiresMs <= 0;
  const canDelete = admin || (cert.certType === "client" && ownedByCurrent);
  const showActivate = admin && cert.certType === "origin" && !cert.isActive && !cert.revokedAt;

  return (
    <div className="border border-border/60 rounded-md p-3 bg-background/50">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-1">
          {cert.revokedAt ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : cert.isActive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{cert.name}</span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
              {cert.certType}
            </Badge>
            {cert.revokedAt ? (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-red-500/10 text-red-700 dark:text-red-300">
                revoked
              </Badge>
            ) : cert.isActive ? (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-muted/70 text-muted-foreground">
                inactive
              </Badge>
            )}
            {cert.hasPrivateKey && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                +key
              </Badge>
            )}
            {expired && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-red-500/10 text-red-700 dark:text-red-300">
                expired
              </Badge>
            )}
            {expiringSoon && !expired && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                expiring
              </Badge>
            )}
          </div>
          {cert.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{cert.description}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <span title={cert.subject ?? ""} className="truncate">
              <span className="text-foreground/60">Subject:</span> {cert.subject || "—"}
            </span>
            <span title={cert.issuer ?? ""} className="truncate">
              <span className="text-foreground/60">Issuer:</span> {cert.issuer || "—"}
            </span>
            <span>
              <span className="text-foreground/60">Valid until:</span>{" "}
              {new Date(cert.validTo).toLocaleString()}
            </span>
            <span className="truncate" title={cert.fingerprintSha256}>
              <span className="text-foreground/60">SHA-256:</span>{" "}
              <code className="font-mono">{cert.fingerprintSha256.slice(0, 16)}…</code>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {showActivate && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onActivate}>
              Activate
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-red-600 hover:text-red-700"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
