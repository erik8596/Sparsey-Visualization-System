from typing import Dict, List
import pandas as pd
import re
import logging

logger = logging.getLogger(__name__)

class NeuronActivationParser:
    """Parser specifically for neuron-level activation data from WandB"""

    def __init__(self):
        # Pattern for detailed neuron activations
        self.neuron_pattern = re.compile(r"^neuron_activations/layer_(\d+)/mac_(\d+)/cm_(\d+)/neuron_(\d+)$")

    def parse_from_history(self, run) -> Dict[str, Dict[int, Dict[int, Dict[int, List[float]]]]]:
        """
        Parse detailed neuron activations from run history data.
        Returns data in the format:
        {
            'layer_1': {
                0: {  # MAC 0
                    1: {  # CM 1
                        0: [1.0, 0.0],  # Neuron 0's activation history
                        1: [0.0, 1.0]   # Neuron 1's activation history
                    }
                }
            }
        }
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            # Find all detailed neuron activation columns
            neuron_cols = [
                col for col in df.columns
                if self.neuron_pattern.match(col)
            ]

            if not neuron_cols:
                logger.warning("No neuron activation columns found in history")
                return {}

            # Build hierarchical structure
            result = {}

            for col in neuron_cols:
                if match := self.neuron_pattern.match(col):
                    layer_idx, mac_idx, cm_idx, neuron_idx = match.groups()
                    layer_name = f"layer_{layer_idx}"
                    mac_idx = int(mac_idx)
                    cm_idx = int(cm_idx)
                    neuron_idx = int(neuron_idx)

                    # Initialize nested dictionaries as needed
                    if layer_name not in result:
                        result[layer_name] = {}
                    if mac_idx not in result[layer_name]:
                        result[layer_name][mac_idx] = {}
                    if cm_idx not in result[layer_name][mac_idx]:
                        result[layer_name][mac_idx][cm_idx] = {}

                    # Get activation values for this neuron, filtering out None and NaN values
                    activations = df[col].dropna().tolist()
                    if activations:
                        # Ensure all values are properly converted to numeric (0 or 1)
                        clean_activations = []
                        for value in activations:
                            try:
                                numeric_val = float(value)
                                # Ensure binary values (0 or 1)
                                clean_activations.append(1.0 if numeric_val > 0 else 0.0)
                            except (ValueError, TypeError):
                                # Skip non-numeric values
                                clean_activations.append(0.0)

                        # Only store if we have valid data
                        if clean_activations:
                            result[layer_name][mac_idx][cm_idx][neuron_idx] = clean_activations

            return result

        except Exception as e:
            logger.error(f"Error parsing neuron activations: {e}")
            return {}

    def get_latest_activations(self, run) -> Dict[str, Dict[int, Dict[int, Dict[int, bool]]]]:
        """
        Get latest neuron activation states (just the most recent values).

        Returns:
            Dict with latest activation state (boolean) for each neuron
        """
        try:
            full_history = self.parse_from_history(run)
            latest_states = {}

            for layer, macs in full_history.items():
                latest_states[layer] = {}

                for mac_idx, cms in macs.items():
                    latest_states[layer][mac_idx] = {}

                    for cm_idx, neurons in cms.items():
                        latest_states[layer][mac_idx][cm_idx] = {}

                        for neuron_idx, activations in neurons.items():
                            # Get the latest activation status (as boolean)
                            if activations and len(activations) > 0:
                                latest = activations[-1] == 1.0
                            else:
                                latest = False

                            latest_states[layer][mac_idx][cm_idx][neuron_idx] = latest

            return latest_states

        except Exception as e:
            logger.error(f"Error getting latest neuron activations: {e}")
            return {}
