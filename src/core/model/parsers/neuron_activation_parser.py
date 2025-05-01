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

    def parse_from_history(self, run, step=None) -> Dict[str, Dict[int, Dict[int, Dict[int, List[float]]]]]:
        """
        Parse detailed neuron activations from run history data, with support for step selection.

        Args:
            run: The WandB run object
            step: Optional step number to retrieve (None = last step)

        Returns:
            Dict with neuron activation data for the selected step
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            if df.empty:
                logger.warning("No history data available for neuron activations")
                return {}

            # Find all detailed neuron activation columns
            neuron_cols = [
                col for col in df.columns
                if self.neuron_pattern.match(col)
            ]

            if not neuron_cols:
                logger.warning("No neuron activation columns found in history")
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
            row_values = df[neuron_cols].iloc[row_idx].to_dict()

            # Build hierarchical structure
            result = {}

            for col, value in row_values.items():
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

                    # Convert to float and ensure binary value
                    try:
                        numeric_val = float(value)
                        clean_value = 1.0 if numeric_val > 0 else 0.0
                    except (ValueError, TypeError):
                        clean_value = 0.0  # Default to inactive

                    # Store as a single-element list
                    result[layer_name][mac_idx][cm_idx][neuron_idx] = [clean_value]

            # Add debugging information
            active_neurons = 0
            for layer in result.values():
                for mac in layer.values():
                    for cm in mac.values():
                        for act in cm.values():
                            if act[0] == 1.0:
                                active_neurons += 1
            logger.info(f"Parsed neuron activations for step {step}: {active_neurons} active neurons")

            return result

        except Exception as e:
            logger.error(f"Error parsing neuron activations (step={step}): {e}")
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
