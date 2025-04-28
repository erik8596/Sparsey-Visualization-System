import re
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class MACActivationParser:
    """Parser for MAC activations (excluding input layer) from WandB summary data"""

    def __init__(self):
        # Updated pattern to only match non-zero layer indices
        self.mac_pattern = re.compile(r"^neuron_activations/layer_([1-9]\d*)/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, Any]) -> Dict[str, Dict[int, int]]:
        """
        Parse MAC activations from summary data (excluding input layer).

        Args:
            summary_data: WandB summary data containing MAC activations

        Returns:
            Dictionary of MAC activations by layer and MAC index
        """
        mac_activations = {}

        try:
            for key, value in summary_data.items():
                if match := self.mac_pattern.match(key):
                    layer_idx, mac_idx = match.groups()
                    mac_idx = int(mac_idx)
                    layer_name = f"layer_{layer_idx}"

                    if layer_name not in mac_activations:
                        mac_activations[layer_name] = {}

                    mac_activations[layer_name][mac_idx] = int(value)

            return mac_activations

        except Exception as e:
            logger.error(f"Error parsing MAC activations: {e}")
            return {}
