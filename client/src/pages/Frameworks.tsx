import { Link } from "wouter";
import { Shield, Brain, Lock, FileCheck } from "lucide-react";

export default function Frameworks() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Security Frameworks</h1>
        <p className="text-muted-foreground mt-1">
          Threat intelligence and risk management frameworks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MITRE ATT&CK */}
        <Link href="/attack">
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:border-primary cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">MITRE ATT&CK</h2>
                <p className="text-sm text-muted-foreground">Traditional adversary tactics</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Comprehensive knowledge base of adversary tactics, techniques, and procedures (TTPs)
              based on real-world observations.
            </p>
          </div>
        </Link>

        {/* MITRE ATLAS */}
        <Link href="/atlas">
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:border-primary cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-8 w-8 text-purple-600" />
              <div>
                <h2 className="text-xl font-bold">MITRE ATLAS</h2>
                <p className="text-sm text-muted-foreground">AI/ML adversarial tactics</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Adversarial Threat Landscape for Artificial-Intelligence Systems. Tactics for
              attacking machine learning models.
            </p>
          </div>
        </Link>

        {/* OWASP LLM Top 10 */}
        <Link href="/owasp-llm">
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:border-primary cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-8 w-8 text-red-600" />
              <div>
                <h2 className="text-xl font-bold">OWASP LLM Top 10</h2>
                <p className="text-sm text-muted-foreground">Large Language Model vulnerabilities</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Top 10 critical vulnerabilities for applications using Large Language Models,
              from prompt injection to model theft.
            </p>
          </div>
        </Link>

        {/* NIST AI RMF */}
        <Link href="/nist-ai">
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border hover:border-primary cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <FileCheck className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold">NIST AI RMF</h2>
                <p className="text-sm text-muted-foreground">AI Risk Management Framework</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              NIST AI 100-1 Risk Management Framework for trustworthy AI systems.
              Govern, Map, Measure, and Manage AI risks.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
