import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

export interface TestCredential {
  account: string;
  password: string;
}

export interface QuestionResponseRow {
  question: string;
  field: string;
  type?: "text" | "textarea" | "select" | "credentials";
  options?: string[];
  placeholder?: string;
}

interface QuestionResponseTableProps {
  rows: QuestionResponseRow[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

function CredentialPairsCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const parseCredentials = (raw: string): TestCredential[] => {
    if (!raw) return [{ account: "", password: "" }];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore parse errors
    }
    return [{ account: "", password: "" }];
  };

  const [credentials, setCredentials] = useState<TestCredential[]>(() => parseCredentials(value));

  const persist = (updated: TestCredential[]) => {
    setCredentials(updated);
    const nonEmpty = updated.filter(c => c.account.trim() !== "" || c.password.trim() !== "");
    onChange(nonEmpty.length > 0 ? JSON.stringify(nonEmpty) : "");
  };

  const handleAccountChange = (index: number, account: string) => {
    const updated = [...credentials];
    updated[index] = { ...updated[index], account };
    persist(updated);
  };

  const handlePasswordChange = (index: number, password: string) => {
    const updated = [...credentials];
    updated[index] = { ...updated[index], password };
    persist(updated);
  };

  const handleAdd = () => {
    if (credentials.length < 10) {
      persist([...credentials, { account: "", password: "" }]);
    }
  };

  const handleRemove = (index: number) => {
    const updated = credentials.filter((_, i) => i !== index);
    persist(updated.length === 0 ? [{ account: "", password: "" }] : updated);
  };

  return (
    <div className="space-y-2">
      {credentials.map((cred, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={cred.account}
            onChange={(e) => handleAccountChange(index, e.target.value)}
            placeholder={placeholder || "Username"}
            className="flex-1"
          />
          <Input
            type="password"
            value={cred.password}
            onChange={(e) => handlePasswordChange(index, e.target.value)}
            placeholder="Password"
            className="flex-1"
          />
          {credentials.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="text-red-500 hover:text-red-700 shrink-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {credentials.length < 10 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Credential
        </Button>
      )}
    </div>
  );
}

export default function QuestionResponseTable({
  rows,
  values,
  onChange,
}: QuestionResponseTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-red-200">
          <tr>
            <th className="text-left p-3 font-semibold text-foreground w-1/3">
              Question
            </th>
            <th className="text-left p-3 font-semibold text-foreground">
              Response
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.field}
              className={index % 2 === 0 ? "bg-card" : "bg-secondary"}
            >
              <td className="p-3 text-sm text-foreground align-top">
                {row.question}
              </td>
              <td className="p-3">
                {row.type === "credentials" ? (
                  <CredentialPairsCell
                    value={values[row.field] || ""}
                    onChange={(val) => onChange(row.field, val)}
                    placeholder={row.placeholder}
                  />
                ) : row.type === "textarea" ? (
                  <Textarea
                    value={values[row.field] || ""}
                    onChange={(e) => onChange(row.field, e.target.value)}
                    placeholder={row.placeholder || ""}
                    rows={3}
                    className="w-full"
                  />
                ) : row.type === "select" ? (
                  <Select
                    value={values[row.field] || ""}
                    onValueChange={(value) => onChange(row.field, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={row.placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {row.options?.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={values[row.field] || ""}
                    onChange={(e) => onChange(row.field, e.target.value)}
                    placeholder={row.placeholder || ""}
                    className="w-full"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
