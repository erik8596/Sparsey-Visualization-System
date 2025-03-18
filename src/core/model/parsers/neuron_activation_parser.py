from typing import Dict, List
import pandas as pd
import numpy as np
import re
import logging

logger = logging.getLogger(__name__)

class NeuronActivationParser:
    """Parser specifically for neuron-level activation data from WandB"""

    def __init__(self):
        self.raw_pattern = re.compile(r"^num_activations/layer_(\d+)/mac_(\d+)/raw$")

    def parse_from_history(self, run) -> Dict[str, Dict[int, List[int]]]:
        """
        Parse only neuron raw activations from run history data.
        Returns:
        {
            'layer_1': {
                0: [1,0,1,0],  # MAC 0's neuron activations
                1: [0,1,0,1],  # MAC 1's neuron activations
                ...
            }
        }
        """
        try:
            # Get raw activation data from history
            raw_cols = self._get_raw_activation_columns(run)
            if not raw_cols:
                return {}

            # Process into layer/MAC structure
            result: Dict[str, Dict[int, List[int]]] = {}
            for col, data in raw_cols.items():
                if not isinstance(data, (list, np.ndarray)):
                    continue

                if match := self.raw_pattern.match(col):
                    layer_idx, mac_idx = match.groups()
                    layer_name = f"layer_{layer_idx}"
                    mac_idx = int(mac_idx)

                    if layer_name not in result:
                        result[layer_name] = {}

                    result[layer_name][mac_idx] = list(map(int, data))

            return result

        except Exception as e:
            logger.error(f"Error parsing neuron activations: {e}")
            return {}

    def _get_raw_activation_columns(self, run) -> Dict[str, List[int]]:
        """Helper to get raw activation data from run history"""
        try:
            history = run.scan_history()
            df = pd.DataFrame(history)
            raw_cols = [col for col in df.columns if '/raw' in col]
            if not raw_cols:
                return {}

            # Get first non-null value for each column
            return {col: df[col].dropna().iloc[0] for col in raw_cols}

        except Exception as e:
            logger.error(f"Error getting raw activation columns: {e}")
            return {}
