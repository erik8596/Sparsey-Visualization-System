import re
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class InputActivationParser:
    """Parser specifically for input layer activations from WandB summary data"""

    def __init__(self):
        self.pattern = re.compile(r"^num_activations/layer_0/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, any]) -> Dict[int, int]:
        """
        Parse input layer MAC activations.

        Args:
            summary_data: WandB summary data containing input layer activations

        Returns:
            Dictionary mapping MAC index to activation state (0 or 1)
        """
        try:
            input_activations = {}

            for key, value in summary_data.items():
                if match := self.pattern.match(key):
                    mac_idx = int(match.group(1))
                    input_activations[mac_idx] = int(value)

            return input_activations

        except Exception as e:
            logger.error(f"Error parsing input layer activations: {e}")
            return {}
