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

    def parse_from_history(self, run, step=None) -> Dict[str, Dict[int, int]]:
        """
        Parse MAC activations from run history data, with support for step selection.

        Args:
            run: The WandB run object
            step: Optional step number to retrieve (None = last step)

        Returns:
            Dict with MAC activation states at the selected step
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

            # Use step parameter to select the appropriate row
            if step is not None:
                if '_step' in df.columns:
                    # Find the row with matching step
                    target_row = df[df['_step'] == step]
                    if target_row.empty:
                        logger.warning(f"Step {step} not found, using last step")
                        row_idx = -1
                    else:
                        row_idx = target_row.index[0]
                else:
                    # Try to use step as direct index if no _step column
                    try:
                        if step < len(df):
                            row_idx = step
                        else:
                            logger.warning(f"Step {step} exceeds available data, using last step")
                            row_idx = -1
                    except:
                        row_idx = -1
            else:
                # Use last row if no step specified
                row_idx = -1

            # Get values for the selected step
            row_values = df[mac_cols].iloc[row_idx].to_dict()

            # Build hierarchical structure
            result = {}

            for col, value in row_values.items():
                if match := self.mac_pattern.match(col):
                    layer_idx, mac_idx = match.groups()
                    layer_name = f"layer_{layer_idx}"
                    mac_idx = int(mac_idx)

                    if layer_name not in result:
                        result[layer_name] = {}

                    # Convert to binary activation
                    try:
                        numeric_val = float(value)
                        result[layer_name][mac_idx] = 1 if numeric_val == 1.0 else 0
                    except (ValueError, TypeError):
                        result[layer_name][mac_idx] = 0  # Default to inactive

            return result

        except Exception as e:
            logger.error(f"Error parsing MAC activations from history (step={step}): {e}")
            return {}
