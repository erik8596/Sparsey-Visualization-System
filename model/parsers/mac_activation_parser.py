import re
from typing import Dict, Any

class MACActivationParser:
    """Parser for MAC activations from WandB summary data"""

    def __init__(self):
        self.pattern = re.compile(r"^num_activations/layer_(\d+)/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, Any]) -> Dict[str, Dict[int, int]]:
        """Parse summary_data for MAC activations"""
        mac_activations = {}

        for key, val in summary_data.items():
            match = self.pattern.match(key)
            if match:
                layer_idx = match.group(1)
                mac_idx = int(match.group(2))
                layer_name = f"layer_{layer_idx}"

                if layer_name not in mac_activations:
                    mac_activations[layer_name] = {}

                mac_activations[layer_name][mac_idx] = val

        return mac_activations
