#!/usr/bin/env python3

"""
ChittyOS Service Client - §36 Compliant Implementation
Provides service registry resolution and orchestrated service calls
"""

import os
import asyncio
import aiohttp
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ChittyOSServiceClient:
    """
    §36 Compliant ChittyOS service client
    Implements REQUEST → REGISTER/RESOLVE → VALIDATE → VERIFY → COMPLY → STORE pattern
    """

    def __init__(self):
        """Initialize with ChittyOS service registry configuration"""
        # Registry configuration (§36)
        self.registry_url = os.getenv("CHITTY_REGISTRY_URL", "https://registry.chitty.cc")
        self.registry_token = os.getenv("CHITTY_REGISTRY_TOKEN")

        # Service tokens (per manual requirements)
        self.chitty_id_token = os.getenv("CHITTY_ID_TOKEN")
        self.chitty_canon_token = os.getenv("CHITTY_CANON_TOKEN")
        self.chitty_verify_token = os.getenv("CHITTY_VERIFY_TOKEN")
        self.chitty_check_token = os.getenv("CHITTY_CHECK_TOKEN")

        # Service cache (avoid repeated registry lookups)
        self._service_cache: Dict[str, str] = {}

        if not self.chitty_id_token:
            raise ValueError("CHITTY_ID_TOKEN required for §36 compliance")

    async def resolve_service(self, service_name: str) -> str:
        """
        Resolve service URL via ChittyRegistry (§31 requirement)

        Args:
            service_name: Service to resolve (e.g., 'foundation-id', 'chittycanon')

        Returns:
            Base URL for the service
        """
        if service_name in self._service_cache:
            return self._service_cache[service_name]

        if not self.registry_token:
            # Fallback for development (remove in production)
            fallback_urls = {
                'foundation-id': 'https://id.chitty.cc',
                'chittycanon': 'https://canon.chitty.cc',
                'chittyschema': 'https://schema.chitty.cc',
                'chittyverify': 'https://verify.chitty.cc',
                'chittycheck': 'https://check.chitty.cc',
                'chittyrouter': 'https://router.chitty.cc'
            }
            if service_name in fallback_urls:
                logger.warning(f"Using fallback URL for {service_name} - registry token not configured")
                return fallback_urls[service_name]

        async with aiohttp.ClientSession() as session:
            response = await session.get(
                f"{self.registry_url}/api/v1/resolve/{service_name}",
                headers={"Authorization": f"Bearer {self.registry_token}"}
            )

            if not response.ok:
                raise RuntimeError(f"Service resolution failed for {service_name}: {response.status}")

            result = await response.json()
            base_url = result["base_url"]
            self._service_cache[service_name] = base_url
            return base_url

    async def mint_chitty_id(self, entity: str, name: str, metadata: Dict[str, Any]) -> str:
        """
        Request ChittyID from Foundation service (§30 requirement)

        Args:
            entity: Entity type (THING, EVNT, etc.)
            name: Entity name
            metadata: Additional metadata

        Returns:
            Minted ChittyID
        """
        id_base = await self.resolve_service('foundation-id')

        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{id_base}/api/v2/chittyid/mint",
                headers={
                    "Authorization": f"Bearer {self.chitty_id_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "entity": entity,
                    "name": name,
                    "format": "simple",
                    "metadata": metadata
                }
            )

            if not response.ok:
                raise RuntimeError(f"ChittyID mint failed: {await response.text()}")

            result = await response.json()
            return result["chitty_id"]

    async def canonicalize_entities(self, places: Optional[List[str]] = None,
                                  properties: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Canonicalize entities via ChittyCanon (§32 requirement)

        Args:
            places: Place identifiers to canonicalize
            properties: Property identifiers to canonicalize

        Returns:
            Canonicalized entity mappings
        """
        canon_base = await self.resolve_service('chittycanon')
        result = {"places": [], "properties": []}

        async with aiohttp.ClientSession() as session:
            # Canonicalize places
            if places:
                for place in places:
                    response = await session.post(
                        f"{canon_base}/api/v1/jurisdiction/validate",
                        headers={
                            "Authorization": f"Bearer {self.chitty_canon_token}",
                            "Content-Type": "application/json"
                        },
                        json={"code": place}
                    )

                    if response.ok:
                        place_data = await response.json()
                        if place_data.get("place"):
                            result["places"].append(place_data["place"])

            # Canonicalize properties (similar pattern)
            if properties:
                for prop in properties:
                    response = await session.post(
                        f"{canon_base}/api/v1/property/validate",
                        headers={
                            "Authorization": f"Bearer {self.chitty_canon_token}",
                            "Content-Type": "application/json"
                        },
                        json={"identifier": prop}
                    )

                    if response.ok:
                        prop_data = await response.json()
                        if prop_data.get("property"):
                            result["properties"].append(prop_data["property"])

        return result

    async def validate_evidence_schema(self, payload: Dict[str, Any]) -> bool:
        """
        Validate evidence via ChittySchema (§16 requirement)

        Args:
            payload: Evidence data to validate

        Returns:
            True if validation passes
        """
        schema_base = await self.resolve_service('chittyschema')

        async with aiohttp.ClientSession() as session:
            # Get schema
            schema_response = await session.get(
                f"{schema_base}/api/v1/schemas/evidence",
                headers={"Authorization": f"Bearer {self.chitty_id_token}"}
            )

            if not schema_response.ok:
                raise RuntimeError(f"Schema fetch failed: {schema_response.status}")

            # Validate against schema
            validation_response = await session.post(
                f"{schema_base}/api/v1/validate/evidence",
                headers={
                    "Authorization": f"Bearer {self.chitty_id_token}",
                    "Content-Type": "application/json"
                },
                json=payload
            )

            return validation_response.ok

    async def verify_evidence_trust(self, chitty_id: str, sha256: str) -> Dict[str, Any]:
        """
        Verify evidence integrity via ChittyVerify (§33 requirement)

        Args:
            chitty_id: Evidence ChittyID
            sha256: File hash for integrity

        Returns:
            Trust verification result
        """
        verify_base = await self.resolve_service('chittyverify')

        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{verify_base}/api/v1/evidence/verify",
                headers={
                    "Authorization": f"Bearer {self.chitty_verify_token}",
                    "Content-Type": "application/json"
                },
                json={"chitty_id": chitty_id, "sha256": sha256}
            )

            if not response.ok:
                raise RuntimeError(f"Trust verification failed: {await response.text()}")

            return await response.json()

    async def validate_compliance(self, chitty_id: str, sha256: str,
                                verify_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate compliance via ChittyCheck (§35 requirement)

        Args:
            chitty_id: Evidence ChittyID
            sha256: File hash
            verify_result: Trust verification result

        Returns:
            Compliance validation result
        """
        check_base = await self.resolve_service('chittycheck')

        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{check_base}/api/v1/validate/evidence",
                headers={
                    "Authorization": f"Bearer {self.chitty_check_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "chitty_id": chitty_id,
                    "sha256": sha256,
                    "verify": verify_result
                }
            )

            if not response.ok:
                raise RuntimeError(f"Compliance validation failed: {await response.text()}")

            return await response.json()

    async def store_evidence_record(self, payload: Dict[str, Any]) -> bool:
        """
        Store canonical evidence record via ChittySchema (§36 requirement)

        Args:
            payload: Complete evidence record with verification and compliance

        Returns:
            True if storage succeeds
        """
        schema_base = await self.resolve_service('chittyschema')

        async with aiohttp.ClientSession() as session:
            response = await session.post(
                f"{schema_base}/api/v1/store/evidence",
                headers={
                    "Authorization": f"Bearer {self.chitty_id_token}",
                    "Content-Type": "application/json"
                },
                json=payload
            )

            return response.ok

    async def ingest_evidence(self, filename: str, sha256: str, raw_data: Dict[str, Any],
                            places: Optional[List[str]] = None,
                            properties: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Complete evidence ingestion following §36 orchestration pattern:
        REQUEST → REGISTER/RESOLVE → VALIDATE → VERIFY → COMPLY → STORE

        Args:
            filename: Evidence filename
            sha256: File hash for integrity
            raw_data: Raw evidence data
            places: Associated places
            properties: Associated properties

        Returns:
            Complete ingestion result with ChittyID, verification, and compliance
        """
        try:
            # 1) Canonicalize entities via ChittyCanon (§32)
            logger.info("Canonicalizing entities via ChittyCanon")
            canonical = await self.canonicalize_entities(places, properties)

            # 2) Request ChittyID from Foundation (§30)
            logger.info("Requesting ChittyID from Foundation")
            chitty_id = await self.mint_chitty_id(
                entity="THING",
                name=f"evidence-{filename}",
                metadata={
                    "namespace": "EVID",
                    "payload_sha256": sha256,
                    "ingestion_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )

            # 3) Prepare evidence payload
            payload = {
                "chitty_id": chitty_id,
                "sha256": sha256,
                "filename": filename,
                "entities": [],
                "places": [p.get("chitty_id") for p in canonical["places"] if p.get("chitty_id")],
                "properties": [p.get("chitty_id") for p in canonical["properties"] if p.get("chitty_id")],
                "raw": raw_data,
                "ingestion_timestamp": datetime.now(timezone.utc).isoformat()
            }

            # 4) Validate via ChittySchema (§16)
            logger.info("Validating evidence schema via ChittySchema")
            if not await self.validate_evidence_schema(payload):
                raise RuntimeError("Evidence schema validation failed")

            # 5) Verify integrity/trust via ChittyVerify (§33)
            logger.info("Verifying evidence trust via ChittyVerify")
            verify_result = await self.verify_evidence_trust(chitty_id, sha256)

            # 6) Validate compliance via ChittyCheck (§35)
            logger.info("Validating compliance via ChittyCheck")
            compliance_result = await self.validate_compliance(chitty_id, sha256, verify_result)

            # 7) Store canonical record via ChittySchema (§36)
            logger.info("Storing canonical evidence record")
            final_payload = {
                **payload,
                "verify": verify_result,
                "compliance": compliance_result
            }

            if not await self.store_evidence_record(final_payload):
                raise RuntimeError("Evidence storage failed")

            logger.info(f"Evidence ingestion complete: {chitty_id}")
            return {
                "chitty_id": chitty_id,
                "verify": verify_result,
                "compliance": compliance_result,
                "canonical": canonical
            }

        except Exception as e:
            logger.error(f"Evidence ingestion failed: {e}")
            raise