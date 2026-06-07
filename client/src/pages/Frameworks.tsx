import { Link } from "wouter";
import { Shield, Brain, Lock, FileCheck, ShieldCheck, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface FrameworkCard {
  href: string;
  icon: typeof Shield;
  iconColor: string;
  title: string;
  tagline: string;
  description: string;
}

const FRAMEWORKS: FrameworkCard[] = [
  {
    href: "/attack",
    icon: Shield,
    iconColor: "text-primary",
    title: "MITRE ATT&CK",
    tagline: "Traditional adversary tactics",
    description:
      "Comprehensive knowledge base of adversary tactics, techniques, and procedures (TTPs) based on real-world observations.",
  },
  {
    href: "/atlas",
    icon: Brain,
    iconColor: "text-info",
    title: "MITRE ATLAS",
    tagline: "AI/ML adversarial tactics",
    description:
      "Adversarial Threat Landscape for Artificial-Intelligence Systems. Tactics for attacking machine learning models.",
  },
  {
    href: "/owasp-llm",
    icon: Lock,
    iconColor: "text-destructive",
    title: "OWASP LLM Top 10",
    tagline: "Large Language Model vulnerabilities",
    description:
      "Top 10 critical vulnerabilities for applications using Large Language Models, from prompt injection to model theft.",
  },
  {
    href: "/nist-ai",
    icon: FileCheck,
    iconColor: "text-info",
    title: "NIST AI RMF",
    tagline: "AI Risk Management Framework",
    description:
      "NIST AI 100-1 Risk Management Framework for trustworthy AI systems. Govern, Map, Measure, and Manage AI risks.",
  },
  {
    href: "/cis",
    icon: ShieldCheck,
    iconColor: "text-success",
    title: "CIS Controls v8",
    tagline: "Critical Security Controls",
    description:
      "18 prioritized security controls with safeguards organized by Implementation Groups for defending against common cyber attacks.",
  },
];

export default function Frameworks() {
  return (
    <div className="p-8">
      <PageHeader
        icon={BookOpen}
        title="Security Frameworks"
        description="Threat intelligence and risk management frameworks"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FRAMEWORKS.map((fw) => {
          const Icon = fw.icon;
          return (
            <Link
              key={fw.href}
              href={fw.href}
              className="block bg-card p-6 rounded-lg shadow-sm border border-border hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-3 mb-4">
                <Icon aria-hidden="true" className={`h-8 w-8 ${fw.iconColor}`} />
                <div>
                  <h2 className="text-xl font-bold">{fw.title}</h2>
                  <p className="text-sm text-muted-foreground">{fw.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{fw.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
