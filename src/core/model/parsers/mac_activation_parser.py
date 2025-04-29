import re
from typing import Dict, Any
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class MACActivationParser:
    """Parser for MAC activations (excluding input layer) from WandB summary data or history"""

    def __init__(self):
        # Updated pattern to only match non-zero layer indices
        self.mac_pattern = re.compile(r"^neuron_activations/layer_([1-9]\d*)/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, Any]) -> Dict[str, Dict[int, int]]:
        """Parse MAC activations from summary data (potentially outdated)"""
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
            logger.error(f"Error parsing MAC activations from summary: {e}")
            return {}

    def parse_from_history(self, run) -> Dict[str, Dict[int, int]]:
        """
        Parse MAC activations from the latest step in history data.
        Returns data in format:
        {
            'layer_1': {
                0: 1,  # MAC 0 is active
                1: 0   # MAC 1 is inactive
            }
        }
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            if df.empty:
                logger.warning("No history data available for MAC activations")
                return {}

            # Find columns matching MAC activations pattern
            mac_cols = [col for col in df.columns if self.mac_pattern.match(col)]

            if not mac_cols:
                logger.warning("No MAC activation columns found in history")
                return {}

            # Get the latest values (last row for each column)
            latest_values = df[mac_cols].iloc[-1].to_dict()

            # Build the result structure
            result = {}

            for col, value in latest_values.items():
                if match := self.mac_pattern.match(col):
                    layer_idx, mac_idx = match.groups()
                    layer_name = f"layer_{layer_idx}"
                    mac_idx = int(mac_idx)

                    if layer_name not in result:
                        result[layer_name] = {}

                    # Convert to integer activation (0 or 1)
                    try:
                        numeric_val = float(value)
                        result[layer_name][mac_idx] = 1 if numeric_val == 1.0 else 0
                    except (ValueError, TypeError):
                        # Default to inactive if can't convert
                        result[layer_name][mac_idx] = 0

            return result

        except Exception as e:
            logger.error(f"Error parsing MAC activations from history: {e}")
            return {}
