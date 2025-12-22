import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleSelectorProps {
  modules: any;
  selectedModules: Record<string, string>;
  onModuleChange: (type: string, path: string) => void;
}

export default function ModuleSelector({
  modules,
  selectedModules,
  onModuleChange,
}: ModuleSelectorProps) {
  const moduleTypes = [
    { key: "exploit", label: "Exploit" },
    { key: "payload", label: "Payload" },
    { key: "auxiliary", label: "Auxiliary" },
    { key: "encoder", label: "Encoder" },
    { key: "post", label: "Post" },
    { key: "evasion", label: "Evasion" },
  ];

  const renderModuleSelect = (type: string, label: string) => {
    const typeModules = modules[type] || {};
    const categories = Object.keys(typeModules);

    return (
      <div key={type} className="space-y-2">
        <Label htmlFor={`module-${type}`} className="text-sm font-medium">
          {label}
        </Label>
        <Select
          value={selectedModules[type] || ""}
          onValueChange={(value) => onModuleChange(type, value)}
        >
          <SelectTrigger id={`module-${type}`} className="w-full">
            <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {categories.length === 0 ? (
              <SelectItem value="none" disabled>
                No modules available
              </SelectItem>
            ) : (
              categories.map((category) => (
                <SelectGroup key={category}>
                  <SelectLabel className="text-xs font-semibold text-gray-500 uppercase">
                    {category.replace(/_/g, " ")}
                  </SelectLabel>
                  {typeModules[category].map((modulePath: string) => {
                    const displayName = modulePath.split("/").pop() || modulePath;
                    
                    return (
                      <SelectItem key={modulePath} value={modulePath} className="pl-6">
                        <span className="text-xs font-mono">{displayName}</span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Module Selection</h3>
      
      {/* 3x2 Grid */}
      <div className="grid grid-cols-3 gap-4">
        {moduleTypes.map((moduleType) =>
          renderModuleSelect(moduleType.key, moduleType.label)
        )}
      </div>

      {/* Selected modules summary */}
      {Object.keys(selectedModules).length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs font-semibold text-blue-900 mb-2">Selected Modules:</p>
          <div className="space-y-1">
            {Object.entries(selectedModules).map(([type, path]) => (
              path && (
                <div key={type} className="text-xs text-blue-800">
                  <span className="font-semibold">{type}:</span>{" "}
                  <span className="font-mono">{path}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
