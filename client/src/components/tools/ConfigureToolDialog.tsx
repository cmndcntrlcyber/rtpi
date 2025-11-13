import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Play } from "lucide-react";
import { Tool } from "@/services/tools";
import { useTargets } from "@/hooks/useTargets";

interface ConfigureToolDialogProps {
  open: boolean;
  tool: Tool | null;
  onClose: () => void;
