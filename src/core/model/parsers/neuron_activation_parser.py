from typing import Dict, List
import pandas as pd
import numpy as np
import re
import logging

logger = logging.getLogger(__name__)

class NeuronActivationParser:
    """Parser specifically for neuron-level activation data from WandB"""

    def __init__(self):
        # Updated pattern to only match non-zero layer indices
        self.activation_pattern = re.compile(r"^num_activations/layer_([1-9]\d*)/mac_(\d+)$")

    def parse_from_history(self, run) -> Dict[str, Dict[int, List[float]]]:
        """
        Parse neuron activations from run history data (excluding input layer).

        Returns:
            Dict mapping layer_name -> {mac_idx -> [activation_values]}
            Example:
            {
                'layer_1': {
                    0: [1.0, 1.0, 0.0],  # MAC 0's activation history
                    1: [0.0, 1.0, 1.0],  # MAC 1's activation history
                }
            }
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            # Find all neuron activation columns (excluding layer 0)
            neuron_cols = [
                col for col in df.columns
                if self.activation_pattern.match(col)
            ]

            if not neuron_cols:
                logger.warning("No neuron activation columns found in history")
                return {}

            # Group by layer
            result: Dict[str, Dict[int, List[float]]] = {}

            for col in neuron_cols:
                if match := self.activation_pattern.match(col):
                    layer_idx, mac_idx = match.groups()
                    layer_name = f"layer_{layer_idx}"
                    mac_idx = int(mac_idx)

                    # Initialize layer dict if needed
                    if layer_name not in result:
                        result[layer_name] = {}

                    # Get activation values for this MAC
                    activations = df[col].dropna().tolist()
                    if activations:
                        result[layer_name][mac_idx] = activations

            print("\n=== Neuron Activations (Non-Input Layers) === {}".format(result))
            return result

        except Exception as e:
            logger.error(f"Error parsing neuron activations: {e}")
            return {}

    def _validate_activation_values(self, values: List[float]) -> bool:
        """Helper to validate activation values are binary (0/1)"""
        return all(v in (0, 1) for v in values)
