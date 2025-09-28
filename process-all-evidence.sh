#!/bin/bash
# Process all real evidence files through proper pipeline

set -euo pipefail

# Case 2024D007847 evidence files
EVIDENCE_FILES=(
    # Court documents
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/the_docket/2024-10-30_Emergency_Petition_TRO_with_Exhibits.pdf:COURT-001"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/the_docket/2025-03-17_Letter_to_Judge_Johnson.pdf:COURT-002"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/the_docket/Motion_for_Declaratory_Judgment.pdf:COURT-003"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/the_docket/Response_to_Show_Cause_FINAL.pdf:COURT-004"

    # Financial evidence
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Colombian_Assets/Alianza_Virtual_Transaction_Detail_July_2023.pdf:FIN-001"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Colombian_Assets/Alianza_Investment_Instructions_Letter_July_2023.pdf:FIN-002"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Colombian_Assets/Alianza_Portfolio_Summary_June_2024.pdf:FIN-003"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Colombian_Assets/Alianza_Client_Statement_June_2024.pdf:FIN-004"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Colombian_Assets/Alianza_Bank_Statement_November_2024.pdf:FIN-005"
    "/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/imported_documents/evidence_vault/Financial_Affidavit_FINAL_for_signature.pdf:FIN-006"
)

echo "Processing ${#EVIDENCE_FILES[@]} evidence files..."
echo "=================================="

for entry in "${EVIDENCE_FILES[@]}"; do
    IFS=':' read -r filepath evidence_id <<< "$entry"

    if [[ -f "$filepath" ]]; then
        echo "Processing: $evidence_id"
        ./evidence-processor.sh process "$filepath" 2024 "$evidence_id"
        echo ""
    else
        echo "⚠️  File not found: $filepath"
    fi
done

echo "=================================="
echo "✅ Evidence processing complete"
echo ""
echo "Metadata stored in: ~/.claude/evidence/"
echo "Ready for Notion sync with real CIDs"