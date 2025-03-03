from abc import ABC, abstractmethod
from typing import Dict, Any

class VisualizationStrategy(ABC):
    """Strategy interface for visualization data processing"""

    @abstractmethod
    def process(self, model_config: Dict[str, Any], mac_activations: Dict[str, Dict[int, int]]) -> Dict[str, Any]:
        pass
