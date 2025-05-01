import re
from typing import Dict
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class InputActivationParser:
    """Parser specifically for input layer activations from WandB summary data or history"""

    def __init__(self):
        self.pattern = re.compile(r"^input_activations/pixel_(\d+)$")

    def parse(self, summary_data: Dict[str, any]) -> Dict[int, int]:
        """Parse input layer MAC activations from summary (potentially outdated)"""
        try:
            input_activations = {}

            for key, value in summary_data.items():
                if match := self.pattern.match(key):
                    mac_idx = int(match.group(1))
                    input_activations[mac_idx] = int(value)

            return input_activations

        except Exception as e:
            logger.error(f"Error parsing input layer activations from summary: {e}")
            return {}

    def parse_from_history(self, run, step=None) -> Dict[int, int]:
        """
        Parse input activations from history data, with support for step selection.

        Args:
            run: The WandB run object
            step: Optional step number to retrieve (None = last step)

        Returns data in format:
            {
                1: 0,  # pixel 1 is inactive
                2: 1   # pixel 2 is active
            }
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            if df.empty:
                logger.warning("No history data available for input activations")
                return {}

            # Find columns matching input activations pattern
            input_cols = [col for col in df.columns if self.pattern.match(col)]

            if not input_cols:
                logger.warning("No input activation columns found in history")
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
            row_values = df[input_cols].iloc[row_idx].to_dict()

            # Build the result structure
            result = {}

            for col, value in row_values.items():
                if match := self.pattern.match(col):
                    pixel_idx = int(match.group(1))

                    # Convert to integer activation (0 or 1)
                    try:
                        numeric_val = float(value)
                        result[pixel_idx] = 1 if numeric_val == 1.0 else 0
                    except (ValueError, TypeError):
                        # Default to inactive if can't convert
                        result[pixel_idx] = 0

            return result

        except Exception as e:
            logger.error(f"Error parsing input activations from history (step={step}): {e}")
            return {}
