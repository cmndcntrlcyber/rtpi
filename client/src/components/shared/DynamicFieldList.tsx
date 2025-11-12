import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus } from "lucide-react";

interface DynamicFieldListProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxFields?: number;
}

export default function DynamicFieldList({
  label,
  values,
  onChange,
  placeholder = "Enter value...",
  maxFields = 3,
}: DynamicFieldListProps) {
  const handleAdd = () => {
    if (values.length < maxFields) {
      onChange([...values, ""]);
    }
  };

  const handleRemove = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues.length === 0 ? [""] : newValues);
  };

  const handleChange = (index: number, value: string) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            {values.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {values.length < maxFields && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add {label}
        </Button>
      )}
      <p className="text-xs text-gray-500">
        {values.length} of {maxFields} {label.toLowerCase()} added
      </p>
    </div>
  );
}
