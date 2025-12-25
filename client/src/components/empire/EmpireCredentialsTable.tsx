import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, EyeOff, Copy, Check, Key, Hash } from "lucide-react";

interface EmpireCredential {
  id: string;
  credType: string;
  username: string;
  password: string | null;
  ntlmHash: string | null;
  sha256Hash: string | null;
  host: string | null;
  os: string | null;
  harvestedAt: string;
}

interface EmpireCredentialsTableProps {
  credentials: EmpireCredential[];
}

export default function EmpireCredentialsTable({
  credentials,
}: EmpireCredentialsTableProps) {
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  if (credentials.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No credentials harvested</p>
        <p className="text-sm text-gray-400 mt-2">
          Credentials will appear here when harvested by agents
        </p>
      </div>
    );
  }

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setCopiedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const getCredTypeBadge = (credType: string) => {
    const types: Record<string, { label: string; variant: string }> = {
      plaintext: { label: "Plaintext", variant: "default" },
      hash: { label: "Hash", variant: "secondary" },
      token: { label: "Token", variant: "outline" },
      kerberos: { label: "Kerberos", variant: "destructive" },
    };

    const type = types[credType.toLowerCase()] || {
      label: credType,
      variant: "outline",
    };

    return (
      <Badge variant={type.variant as any} className="font-mono text-xs">
        {type.label}
      </Badge>
    );
  };

  const formatSecret = (credential: EmpireCredential, visible: boolean) => {
    const secret =
      credential.password || credential.ntlmHash || credential.sha256Hash || "";

    if (!secret) return <span className="text-gray-400 italic">N/A</span>;

    const icon = credential.password ? (
      <Key className="h-3 w-3 inline mr-1" />
    ) : (
      <Hash className="h-3 w-3 inline mr-1" />
    );

    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">
          {icon}
          {visible ? secret : "•".repeat(Math.min(secret.length, 20))}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => toggleSecretVisibility(credential.id)}
          >
            {visible ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => copyToClipboard(secret, credential.id)}
          >
            {copiedIds.has(credential.id) ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  const formatUsername = (credential: EmpireCredential) => {
    if (credential.host) {
      return (
        <div className="space-y-1">
          <p className="font-mono text-sm">{credential.username}</p>
          <p className="text-xs text-gray-500">@{credential.host}</p>
        </div>
      );
    }
    return <span className="font-mono text-sm">{credential.username}</span>;
  };

  const credentialCounts = {
    total: credentials.length,
    plaintext: credentials.filter((c) => c.password).length,
    hashes: credentials.filter((c) => c.ntlmHash || c.sha256Hash).length,
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Secret</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Harvested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map((credential) => (
              <TableRow key={credential.id}>
                <TableCell>{getCredTypeBadge(credential.credType)}</TableCell>
                <TableCell>{formatUsername(credential)}</TableCell>
                <TableCell>
                  {formatSecret(
                    credential,
                    visibleSecrets.has(credential.id)
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">
                    {credential.os || "Unknown"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(credential.harvestedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-6">
            <div>
              <span className="font-medium text-gray-700">Total:</span>{" "}
              <span className="font-semibold">{credentialCounts.total}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Plaintext:</span>{" "}
              <span className="font-semibold text-orange-600">
                {credentialCounts.plaintext}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Hashes:</span>{" "}
              <span className="font-semibold text-blue-600">
                {credentialCounts.hashes}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
