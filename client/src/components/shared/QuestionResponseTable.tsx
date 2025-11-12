import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface QuestionResponseRow {
  question: string;
  field: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
}

interface QuestionResponseTableProps {
  rows: QuestionResponseRow[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function QuestionResponseTable({
  rows,
  values,
  onChange,
}: QuestionResponseTableProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-purple-100">
          <tr>
            <th className="text-left p-3 font-semibold text-gray-900 w-1/3">
              Question
            </th>
            <th className="text-left p-3 font-semibold text-gray-900">
              Response
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.field}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="p-3 text-sm text-gray-900 align-top">
                {row.question}
              </td>
              <td className="p-3">
                {row.type === "textarea" ? (
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
