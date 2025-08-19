import { motion } from "framer-motion";
import { BarChart3, FileText, DollarSign, AlertTriangle } from "lucide-react";

interface ClaimsAnalysisProps {
  pov: string;
}

export function ClaimsAnalysis({ pov }: ClaimsAnalysisProps) {
  const getClaimsData = () => {
    switch (pov) {
      case 'aribia':
        return {
          title: "Defense Analysis",
          claims: [
            { type: "Pre-Marital Asset", strength: 95, description: "ARIBIA formed 5 months before marriage" },
            { type: "Separate Funding", strength: 90, description: "Colombian property purchased with pre-marital funds" },
            { type: "Due Process", strength: 85, description: "Member removal followed operating agreement" },
            { type: "Business Operations", strength: 80, description: "TRO preventing normal business activities" }
          ]
        };
      case 'sharon':
        return {
          title: "Lender Protection",
          claims: [
            { type: "Loan Security", strength: 100, description: "$100K secured by two properties" },
            { type: "Administrative Authority", strength: 95, description: "Appointed Interim President April 2025" },
            { type: "Non-Marital Interest", strength: 100, description: "No connection to marital assets" },
            { type: "Governance Rights", strength: 90, description: "15% IT CAN BE LLC member" }
          ]
        };
      case 'luisa':
        return {
          title: "Former Member Claims",
          claims: [
            { type: "Marital Asset Rights", strength: 65, description: "Claims ARIBIA as marital property" },
            { type: "Improper Removal", strength: 45, description: "Disputes member removal process" },
            { type: "Asset Dissipation", strength: 30, description: "Alleges improper asset transfers" },
            { type: "Emergency Relief", strength: 25, description: "TRO for asset protection" }
          ]
        };
      case 'legal':
        return {
          title: "Legal Assessment",
          claims: [
            { type: "Corporate Veil", strength: 88, description: "Strong entity separation documentation" },
            { type: "Timeline Evidence", strength: 92, description: "Clear chronological formation record" },
            { type: "Financial Documentation", strength: 85, description: "Comprehensive transaction records" },
            { type: "TRO Validity", strength: 40, description: "Emergency standard questionable" }
          ]
        };
      case 'colombia':
        return {
          title: "International Compliance",
          claims: [
            { type: "Foreign Investment", strength: 90, description: "Proper documentation for property acquisition" },
            { type: "Eviction Proceedings", strength: 75, description: "Legal process requires litigation counsel" },
            { type: "Asset Recovery", strength: 80, description: "ARIBIA ownership of appliances documented" },
            { type: "Regulatory Compliance", strength: 95, description: "AML requirements properly followed" }
          ]
        };
      default:
        return {
          title: "Analysis Overview",
          claims: []
        };
    }
  };

  const data = getClaimsData();

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'var(--aribia-green)';
    if (strength >= 60) return 'var(--aribia-amber)';
    return 'var(--aribia-red)';
  };

  return (
    <div className="modern-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{data.title}</h3>
          <p className="text-muted-foreground text-sm">Legal position strength assessment</p>
        </div>
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
          <BarChart3 className="text-primary" size={16} />
        </div>
      </div>

      <div className="space-y-4">
        {data.claims.map((claim, index) => (
          <motion.div
            key={claim.type}
            className="p-4 border border-border rounded-xl hover:border-primary/50 smooth-hover"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground">{claim.type}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold" style={{ color: getStrengthColor(claim.strength) }}>
                  {claim.strength}%
                </span>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${claim.strength}%`,
                      backgroundColor: getStrengthColor(claim.strength)
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{claim.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}