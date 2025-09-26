#!/usr/bin/env python3

"""
AI Processing Bridge for ChittyOS-Data → ChittyLedger Metadata Flow
Enhances evidence with AI-powered analysis and confidence scoring
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import aiohttp
import hashlib
import mimetypes
from dataclasses import dataclass, asdict

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class AIAnalysisResult:
    """Structured AI analysis result"""
    confidence_score: float
    content_type: str
    relevance_score: float
    legal_significance: str
    entity_mentions: List[str]
    key_dates: List[str]
    potential_evidence_types: List[str]
    content_summary: str
    quality_score: float
    processing_version: str
    analysis_timestamp: str
    warnings: List[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        if result.get("warnings") is None:
            result["warnings"] = []
        return result

class AIMetadataBridge:
    """
    AI-powered metadata enhancement bridge between ChittyOS-Data and ChittyLedger
    """

    def __init__(self, case_id: str):
        self.case_id = case_id
        self.ai_processing_version = "1.2.0"

        # AI service endpoints (configurable)
        self.openai_endpoint = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        self.openai_key = os.getenv("OPENAI_API_KEY")

        # Local analysis capabilities
        self.enable_local_analysis = True
        self.enable_cloud_analysis = bool(self.openai_key)

    async def enhance_evidence_metadata(self, file_path: Union[str, Path],
                                      base_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance evidence metadata with AI analysis

        Args:
            file_path: Path to evidence file
            base_metadata: Basic file metadata from ChittyOS

        Returns:
            Enhanced metadata with AI analysis results
        """

        file_path = Path(file_path)
        logger.info(f"Starting AI analysis for {file_path.name}")

        # Initialize enhanced metadata with base
        enhanced = base_metadata.copy()

        try:
            # Perform AI analysis
            ai_result = await self._analyze_file_content(file_path)

            # Merge AI results
            enhanced.update({
                "ai_analysis": ai_result.to_dict(),
                "ai_processing_timestamp": datetime.now(timezone.utc).isoformat(),
                "ai_processing_version": self.ai_processing_version,
                "chittyledger_ready": self._is_chittyledger_ready(ai_result)
            })

            # Add ChittyLedger confidence scoring
            enhanced["chittyledger_confidence"] = self._calculate_chittyledger_confidence(ai_result)

            # Classification for legal evidence
            enhanced["evidence_classification"] = self._classify_for_legal(ai_result, file_path)

            logger.info(f"AI analysis complete for {file_path.name} "
                       f"(confidence: {ai_result.confidence_score:.2f})")

        except Exception as e:
            logger.error(f"AI analysis failed for {file_path.name}: {e}")
            enhanced.update({
                "ai_analysis_error": str(e),
                "ai_processing_timestamp": datetime.now(timezone.utc).isoformat(),
                "chittyledger_ready": False,
                "chittyledger_confidence": 0.0
            })

        return enhanced

    async def _analyze_file_content(self, file_path: Path) -> AIAnalysisResult:
        """Perform comprehensive AI analysis of file content"""

        # Determine file type and content
        mime_type, _ = mimetypes.guess_type(file_path)
        file_size = file_path.stat().st_size

        # Basic content extraction
        content_text = await self._extract_text_content(file_path)

        # Initialize analysis result
        analysis = AIAnalysisResult(
            confidence_score=0.0,
            content_type=mime_type or "unknown",
            relevance_score=0.0,
            legal_significance="unknown",
            entity_mentions=[],
            key_dates=[],
            potential_evidence_types=[],
            content_summary="",
            quality_score=0.0,
            processing_version=self.ai_processing_version,
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
            warnings=[]
        )

        # Local analysis (always available)
        if self.enable_local_analysis:
            local_analysis = await self._local_content_analysis(content_text, file_path)
            analysis = self._merge_analysis_results(analysis, local_analysis)

        # Cloud-based analysis (if available)
        if self.enable_cloud_analysis and content_text:
            try:
                cloud_analysis = await self._cloud_content_analysis(content_text, file_path)
                analysis = self._merge_analysis_results(analysis, cloud_analysis)
            except Exception as e:
                logger.warning(f"Cloud analysis failed, using local only: {e}")
                analysis.warnings.append(f"Cloud analysis unavailable: {e}")

        # Post-process analysis
        analysis = self._post_process_analysis(analysis, file_path)

        return analysis

    async def _extract_text_content(self, file_path: Path) -> str:
        """Extract text content from various file types"""

        try:
            if file_path.suffix.lower() == '.pdf':
                return await self._extract_pdf_text(file_path)
            elif file_path.suffix.lower() in ['.txt', '.md', '.csv']:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()
            elif file_path.suffix.lower() == '.json':
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    return json.dumps(data, indent=2)
            else:
                # Try to read as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()[:10000]  # Limit size

        except Exception as e:
            logger.warning(f"Could not extract text from {file_path}: {e}")
            return ""

    async def _extract_pdf_text(self, file_path: Path) -> str:
        """Extract text from PDF files"""
        # Would integrate with PDF processing library
        # For now, return placeholder
        return f"PDF content from {file_path.name} (extraction not implemented)"

    async def _local_content_analysis(self, content: str, file_path: Path) -> AIAnalysisResult:
        """Local content analysis using pattern matching and heuristics"""

        # Legal keywords and patterns
        legal_keywords = [
            "court", "motion", "tro", "restraining order", "injunction",
            "plaintiff", "defendant", "evidence", "exhibit", "deposition",
            "contract", "agreement", "breach", "damages", "settlement"
        ]

        entity_patterns = [
            r"\b[A-Z][a-z]+ [A-Z][a-z]+\b",  # Names
            r"\b\d{4}D\d{6}\b",  # Case numbers
            r"\$[\d,]+\.?\d*\b",  # Money amounts
        ]

        date_patterns = [
            r"\b\d{1,2}/\d{1,2}/\d{4}\b",
            r"\b\d{4}-\d{2}-\d{2}\b",
            r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b"
        ]

        # Analyze content
        content_lower = content.lower()

        # Legal relevance scoring
        legal_matches = sum(1 for keyword in legal_keywords if keyword in content_lower)
        legal_relevance = min(legal_matches / 10.0, 1.0)

        # Entity extraction (simplified)
        import re
        entities = []
        for pattern in entity_patterns:
            entities.extend(re.findall(pattern, content))

        # Date extraction
        dates = []
        for pattern in date_patterns:
            dates.extend(re.findall(pattern, content))

        # Evidence type classification
        evidence_types = []
        if "email" in content_lower or "message" in content_lower:
            evidence_types.append("Communication")
        if "contract" in content_lower or "agreement" in content_lower:
            evidence_types.append("Contract")
        if "screenshot" in file_path.name.lower() or file_path.suffix.lower() in ['.png', '.jpg']:
            evidence_types.append("Visual Evidence")

        # Quality assessment
        quality_factors = [
            len(content) > 100,  # Sufficient content
            legal_relevance > 0.1,  # Legal relevance
            len(entities) > 0,  # Contains entities
            len(dates) > 0  # Contains dates
        ]
        quality_score = sum(quality_factors) / len(quality_factors)

        return AIAnalysisResult(
            confidence_score=0.7 if legal_relevance > 0.2 else 0.4,
            content_type="legal_document" if legal_relevance > 0.3 else "document",
            relevance_score=legal_relevance,
            legal_significance="high" if legal_relevance > 0.5 else "medium" if legal_relevance > 0.2 else "low",
            entity_mentions=entities[:10],  # Limit list size
            key_dates=dates[:5],
            potential_evidence_types=evidence_types,
            content_summary=content[:200] + "..." if len(content) > 200 else content,
            quality_score=quality_score,
            processing_version=f"{self.ai_processing_version}-local",
            analysis_timestamp=datetime.now(timezone.utc).isoformat()
        )

    async def _cloud_content_analysis(self, content: str, file_path: Path) -> AIAnalysisResult:
        """Cloud-based AI analysis using OpenAI or similar"""

        if not self.openai_key:
            raise ValueError("OpenAI API key not available")

        prompt = f"""
        Analyze this legal evidence file for a court case. File: {file_path.name}

        Content:
        {content[:4000]}

        Please provide analysis in JSON format with:
        - confidence_score (0-1): How confident you are in this analysis
        - content_type: Type of document (email, contract, court_filing, etc.)
        - relevance_score (0-1): Legal relevance to case
        - legal_significance: "high", "medium", or "low"
        - entity_mentions: List of important people, companies, case numbers
        - key_dates: List of important dates found
        - potential_evidence_types: List of evidence categories
        - content_summary: Brief summary of key points
        - quality_score (0-1): Overall quality/usefulness of evidence

        Return only valid JSON.
        """

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json"
                }

                payload = {
                    "model": "gpt-4",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000,
                    "temperature": 0.3
                }

                async with session.post(f"{self.openai_endpoint}/chat/completions",
                                      headers=headers, json=payload) as response:

                    if response.status == 200:
                        result = await response.json()
                        ai_response = result["choices"][0]["message"]["content"]

                        # Parse JSON response
                        analysis_data = json.loads(ai_response)

                        return AIAnalysisResult(
                            confidence_score=analysis_data.get("confidence_score", 0.5),
                            content_type=analysis_data.get("content_type", "unknown"),
                            relevance_score=analysis_data.get("relevance_score", 0.0),
                            legal_significance=analysis_data.get("legal_significance", "unknown"),
                            entity_mentions=analysis_data.get("entity_mentions", []),
                            key_dates=analysis_data.get("key_dates", []),
                            potential_evidence_types=analysis_data.get("potential_evidence_types", []),
                            content_summary=analysis_data.get("content_summary", ""),
                            quality_score=analysis_data.get("quality_score", 0.0),
                            processing_version=f"{self.ai_processing_version}-cloud",
                            analysis_timestamp=datetime.now(timezone.utc).isoformat()
                        )
                    else:
                        raise Exception(f"API request failed: {response.status}")

        except Exception as e:
            logger.error(f"Cloud analysis failed: {e}")
            raise

    def _merge_analysis_results(self, base: AIAnalysisResult, additional: AIAnalysisResult) -> AIAnalysisResult:
        """Merge analysis results from different sources"""

        # Take the higher confidence scores
        merged_confidence = max(base.confidence_score, additional.confidence_score)

        # Merge entity mentions (deduplicate)
        merged_entities = list(set(base.entity_mentions + additional.entity_mentions))

        # Merge key dates (deduplicate)
        merged_dates = list(set(base.key_dates + additional.key_dates))

        # Merge evidence types
        merged_types = list(set(base.potential_evidence_types + additional.potential_evidence_types))

        # Use the better quality score
        merged_quality = max(base.quality_score, additional.quality_score)

        # Combine summaries if both exist
        summary = additional.content_summary if additional.content_summary else base.content_summary

        return AIAnalysisResult(
            confidence_score=merged_confidence,
            content_type=additional.content_type if additional.content_type != "unknown" else base.content_type,
            relevance_score=max(base.relevance_score, additional.relevance_score),
            legal_significance=additional.legal_significance if additional.legal_significance != "unknown" else base.legal_significance,
            entity_mentions=merged_entities[:15],  # Limit size
            key_dates=merged_dates[:10],
            potential_evidence_types=merged_types,
            content_summary=summary,
            quality_score=merged_quality,
            processing_version=f"{base.processing_version}+{additional.processing_version}",
            analysis_timestamp=datetime.now(timezone.utc).isoformat()
        )

    def _post_process_analysis(self, analysis: AIAnalysisResult, file_path: Path) -> AIAnalysisResult:
        """Post-process analysis results for consistency and validation"""

        # Ensure scores are in valid ranges
        analysis.confidence_score = max(0.0, min(1.0, analysis.confidence_score))
        analysis.relevance_score = max(0.0, min(1.0, analysis.relevance_score))
        analysis.quality_score = max(0.0, min(1.0, analysis.quality_score))

        # Add file-specific insights
        if file_path.suffix.lower() == '.pdf':
            analysis.potential_evidence_types.append("Document")
        elif file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
            analysis.potential_evidence_types.append("Visual Evidence")

        # Validate legal significance
        if analysis.legal_significance not in ["high", "medium", "low"]:
            if analysis.relevance_score > 0.7:
                analysis.legal_significance = "high"
            elif analysis.relevance_score > 0.4:
                analysis.legal_significance = "medium"
            else:
                analysis.legal_significance = "low"

        return analysis

    def _is_chittyledger_ready(self, analysis: AIAnalysisResult) -> bool:
        """Determine if evidence is ready for ChittyLedger minting"""

        readiness_criteria = [
            analysis.confidence_score >= 0.6,
            analysis.quality_score >= 0.5,
            analysis.relevance_score >= 0.3,
            len(analysis.content_summary) > 10
        ]

        return sum(readiness_criteria) >= 3

    def _calculate_chittyledger_confidence(self, analysis: AIAnalysisResult) -> float:
        """Calculate confidence score for ChittyLedger entry"""

        # Weighted combination of analysis metrics
        weights = {
            "confidence": 0.4,
            "quality": 0.3,
            "relevance": 0.3
        }

        chittyledger_confidence = (
            analysis.confidence_score * weights["confidence"] +
            analysis.quality_score * weights["quality"] +
            analysis.relevance_score * weights["relevance"]
        )

        return round(chittyledger_confidence, 3)

    def _classify_for_legal(self, analysis: AIAnalysisResult, file_path: Path) -> Dict[str, Any]:
        """Classify evidence for legal case management"""

        classification = {
            "category": "Unknown",
            "subcategory": "Other",
            "priority": "Low",
            "admissibility_likelihood": "Unknown",
            "recommended_action": "Review"
        }

        # Categorization based on analysis
        if "communication" in analysis.potential_evidence_types or "email" in analysis.content_type.lower():
            classification["category"] = "Communications"
            classification["subcategory"] = "Email/Messages"
        elif "contract" in analysis.potential_evidence_types or "contract" in analysis.content_type.lower():
            classification["category"] = "Contracts"
            classification["subcategory"] = "Agreement"
        elif "court" in analysis.content_type.lower() or any("court" in et.lower() for et in analysis.potential_evidence_types):
            classification["category"] = "Court Documents"
            classification["subcategory"] = "Filing"

        # Priority based on legal significance
        if analysis.legal_significance == "high":
            classification["priority"] = "High"
            classification["recommended_action"] = "Immediate Review"
        elif analysis.legal_significance == "medium":
            classification["priority"] = "Medium"
            classification["recommended_action"] = "Standard Review"

        # Admissibility likelihood
        if analysis.quality_score > 0.7 and analysis.confidence_score > 0.8:
            classification["admissibility_likelihood"] = "High"
        elif analysis.quality_score > 0.5 and analysis.confidence_score > 0.6:
            classification["admissibility_likelihood"] = "Medium"
        else:
            classification["admissibility_likelihood"] = "Low"

        return classification


async def main():
    """Example usage of AI Metadata Bridge"""

    case_id = "2024D007847"
    bridge = AIMetadataBridge(case_id)

    # Example file analysis
    test_file = Path("TRO_DISSOLUTION_MATERIALS_FOR_ROB_VANGUARD.md")

    if test_file.exists():
        base_metadata = {
            "file_name": test_file.name,
            "file_size": test_file.stat().st_size,
            "file_type": "MD"
        }

        enhanced = await bridge.enhance_evidence_metadata(test_file, base_metadata)

        print("AI Analysis Results:")
        print(f"Confidence: {enhanced['ai_analysis']['confidence_score']:.2f}")
        print(f"Legal Significance: {enhanced['ai_analysis']['legal_significance']}")
        print(f"ChittyLedger Ready: {enhanced['chittyledger_ready']}")
        print(f"Evidence Types: {enhanced['ai_analysis']['potential_evidence_types']}")


if __name__ == "__main__":
    asyncio.run(main())