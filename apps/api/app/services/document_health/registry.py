from app.services.document_health.detectors.age import AgeDetector
from app.services.document_health.detectors.broken_links import BrokenLinksDetector
from app.services.document_health.detectors.contradiction import ContradictionDetector
from app.services.document_health.detectors.orphan import OrphanDetector
from app.services.document_health.detectors.version_citation import VersionCitationDetector

PHASE_A_DETECTORS = [
    AgeDetector(),
    BrokenLinksDetector(),
    OrphanDetector(),
    VersionCitationDetector(),
]

PHASE_B_DETECTORS = [
    ContradictionDetector(),
]

ALL_DETECTORS = PHASE_A_DETECTORS + PHASE_B_DETECTORS
